package com.bearoundreactsdk

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.module.annotations.ReactModule
import io.bearound.sdk.BeAroundSDK
import io.bearound.sdk.interfaces.BeAroundSDKListener
import io.bearound.sdk.models.Beacon
import io.bearound.sdk.models.BeaconMetadata
import io.bearound.sdk.models.ForegroundScanConfig
import io.bearound.sdk.models.MaxQueuedPayloads
import io.bearound.sdk.models.NotificationContent
import io.bearound.sdk.models.RssiStats
import io.bearound.sdk.models.ScanPrecision
import io.bearound.sdk.models.UserProperties

@ReactModule(name = BearoundReactSdkModule.NAME)
class BearoundReactSdkModule(private val ctx: ReactApplicationContext) :
  NativeBearoundReactSdkSpec(ctx), BeAroundSDKListener {

  companion object {
    const val NAME = "BearoundReactSdk"
    private const val EVENT_BEACONS = "bearound:beacons"
    private const val EVENT_SYNC_LIFECYCLE = "bearound:syncLifecycle"
    private const val EVENT_BACKGROUND_DETECTION = "bearound:backgroundDetection"
    private const val EVENT_SCANNING = "bearound:scanning"
    private const val EVENT_ERROR = "bearound:error"
    // v2.4 — beacon region lifecycle
    private const val EVENT_BEACON_REGION = "bearound:beaconRegion"
    private const val EVENT_ACTIVE_SCAN = "bearound:activeScan"
    private const val EVENT_BLUETOOTH_STATE = "bearound:bluetoothState"
  }

  private val mainHandler = Handler(Looper.getMainLooper())

  // Dynamic foreground-notification content set from JS; returned synchronously
  // to the native SDK via onProvideNotificationContent.
  @Volatile
  private var notificationContent: NotificationContent? = null

  // Bluetooth adapter state — emitted live so JS can mirror the iOS "Bluetooth eye".
  private val btStateReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      val payload = Arguments.createMap()
      payload.putString("state", currentBluetoothState())
      sendEvent(EVENT_BLUETOOTH_STATE, payload)
    }
  }

  init {
    try {
      ContextCompat.registerReceiver(
        ctx,
        btStateReceiver,
        IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED),
        ContextCompat.RECEIVER_EXPORTED
      )
    } catch (_: Throwable) {
      // Receiver registration is best-effort; getBluetoothState() still works.
    }
  }

  override fun invalidate() {
    try {
      ctx.unregisterReceiver(btStateReceiver)
    } catch (_: Throwable) {
      // already unregistered / never registered
    }
    super.invalidate()
  }
  
  private val sdk: BeAroundSDK by lazy {
    if (Looper.myLooper() == Looper.getMainLooper()) {
      BeAroundSDK.getInstance(ctx.applicationContext)
    } else {
      var instance: BeAroundSDK? = null
      mainHandler.post {
        instance = BeAroundSDK.getInstance(ctx.applicationContext)
      }
      while (instance == null) {
        Thread.sleep(10)
      }
      instance!!
    }
  }

  override fun getName() = NAME

  override fun configure(
    businessToken: String,
    scanPrecision: String,
    maxQueuedPayloads: Double,
    promise: Promise
  ) {
    try {
      if (businessToken.trim().isEmpty()) {
        promise.reject("INVALID_ARGUMENT", "Business token is required")
        return
      }

      val precision = mapToScanPrecision(scanPrecision)
      val maxQueued = mapToMaxQueuedPayloads(maxQueuedPayloads.toInt())

      val wasScanning = sdk.isScanning
      if (wasScanning) {
        sdk.stopScanning()
      }

      sdk.listener = this

      sdk.configure(
        businessToken = businessToken.trim(),
        scanPrecision = precision,
        maxQueuedPayloads = maxQueued
      )

      if (wasScanning) {
        sdk.startScanning()
      }

      promise.resolve(null)
    } catch (t: Throwable) {
      promise.reject("CONFIG_ERROR", t)
    }
  }

  override fun startScanning(promise: Promise) {
    try {
      // Ensure listener is set before starting scan
      sdk.listener = this
      sdk.startScanning()
      promise.resolve(null)
    } catch (t: Throwable) {
      promise.reject("START_ERROR", t)
    }
  }

  override fun stopScanning(promise: Promise) {
    try {
      sdk.stopScanning()
      promise.resolve(null)
    } catch (t: Throwable) {
      promise.reject("STOP_ERROR", t)
    }
  }

  override fun isScanning(promise: Promise) {
    promise.resolve(sdk.isScanning)
  }

  override fun setUserProperties(properties: ReadableMap, promise: Promise) {
    try {
      val userProperties = mapUserProperties(properties)
      sdk.setUserProperties(userProperties)
      promise.resolve(null)
    } catch (t: Throwable) {
      promise.reject("USER_PROPERTIES_ERROR", t)
    }
  }

  override fun clearUserProperties(promise: Promise) {
    try {
      sdk.clearUserProperties()
      promise.resolve(null)
    } catch (t: Throwable) {
      promise.reject("USER_PROPERTIES_ERROR", t)
    }
  }

  override fun checkPermissions(promise: Promise) {
    promise.resolve(true)
  }

  override fun requestPermissions(promise: Promise) {
    promise.resolve(true)
  }

  // Diagnostic / state getters (parity with native public API).
  // The Android SDK does not expose every iOS getter; those resolve to a
  // neutral default and are documented as iOS-only in the TS layer.

  override fun getSdkVersion(promise: Promise) {
    // The Android SDK exposes no public version getter (unlike iOS BeAroundSDK.version).
    promise.resolve("")
  }

  override fun getCurrentScanPrecision(promise: Promise) {
    promise.resolve(sdk.currentScanPrecision?.name?.lowercase() ?: "")
  }

  override fun getBleDiagnosticInfo(promise: Promise) {
    // No Android equivalent of iOS bleDiagnosticInfo.
    promise.resolve("")
  }

  override fun getPendingBatchCount(promise: Promise) {
    // No public pending-batch getter on Android.
    promise.resolve(0.0)
  }

  override fun isConfigured(promise: Promise) {
    promise.resolve(sdk.isConfigured)
  }

  override fun isLocationAvailable(promise: Promise) {
    promise.resolve(sdk.isLocationAvailable())
  }

  override fun getAuthorizationStatus(promise: Promise) {
    promise.resolve(sdk.getLocationPermissionStatus())
  }

  override fun getBluetoothState(promise: Promise) {
    promise.resolve(currentBluetoothState())
  }

  override fun getPersistedLog(promise: Promise) {
    promise.resolve(sdk.getDetectionLogJson())
  }

  override fun clearPersistedLog(promise: Promise) {
    sdk.clearDetectionLog()
    promise.resolve(null)
  }

  private fun currentBluetoothState(): String {
    val manager = ctx.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    val adapter = manager?.adapter ?: return "unsupported"
    if (!adapter.isEnabled) return "poweredOff"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val granted = ContextCompat.checkSelfPermission(
        ctx,
        Manifest.permission.BLUETOOTH_SCAN
      ) == PackageManager.PERMISSION_GRANTED
      if (!granted) return "unauthorized"
    }
    return "poweredOn"
  }

  override fun requestLocationAuthorization(level: String, promise: Promise) {
    // Android runtime location permissions are requested from JS (see permissions.ts)
    // and declared in the manifest — there is no native call to make here.
    promise.resolve(null)
  }

  // Foreground-service scanning (Android-only) — persistent notification keeps the
  // process alive on aggressive OEMs while scanning in background.

  override fun enableForegroundScanning(config: ReadableMap, promise: Promise) {
    try {
      sdk.enableForegroundScanning(mapForegroundScanConfig(config))
      promise.resolve(null)
    } catch (t: Throwable) {
      promise.reject("FOREGROUND_SCAN_ERROR", t)
    }
  }

  override fun disableForegroundScanning(promise: Promise) {
    try {
      sdk.disableForegroundScanning()
      promise.resolve(null)
    } catch (t: Throwable) {
      promise.reject("FOREGROUND_SCAN_ERROR", t)
    }
  }

  override fun isForegroundScanningEnabled(promise: Promise) {
    promise.resolve(sdk.isForegroundScanningEnabled)
  }

  override fun setForegroundNotificationContent(content: ReadableMap, promise: Promise) {
    val title = content.getString("title")
    val text = content.getString("text")
    notificationContent =
      if (title != null && text != null) NotificationContent(title, text) else null
    promise.resolve(null)
  }

  private fun mapForegroundScanConfig(args: ReadableMap): ForegroundScanConfig {
    val default = ForegroundScanConfig()
    return ForegroundScanConfig(
      enabled = true,
      notificationTitle = args.getString("notificationTitle") ?: default.notificationTitle,
      notificationText = args.getString("notificationText") ?: default.notificationText,
      notificationChannelId = args.getString("notificationChannelId"),
      notificationChannelName = args.getString("notificationChannelName")
        ?: default.notificationChannelName
    )
  }

  override fun addListener(eventName: String) {
    // Required for NativeEventEmitter; events are emitted from the SDK delegate.
  }

  override fun removeListeners(count: Double) {
    // Required for NativeEventEmitter; no-op for now.
  }

  // BeAroundSDKListener callbacks (v2.2.1)
  
  override fun onBeaconsUpdated(beacons: List<Beacon>) {
    val payload = Arguments.createMap()
    payload.putArray("beacons", mapBeacons(beacons))
    sendEvent(EVENT_BEACONS, payload)
  }

  override fun onError(error: Exception) {
    val payload = Arguments.createMap()
    payload.putString("message", error.message ?: "Unknown error")
    sendEvent(EVENT_ERROR, payload)
  }

  override fun onScanningStateChanged(isScanning: Boolean) {
    val payload = Arguments.createMap()
    payload.putBoolean("isScanning", isScanning)
    sendEvent(EVENT_SCANNING, payload)
  }
  
  override fun onAppStateChanged(isInBackground: Boolean) {
    // Not needed for React Native - handled by framework
  }
  
  override fun onSyncStarted(beaconCount: Int) {
    val payload = Arguments.createMap()
    payload.putString("type", "started")
    payload.putInt("beaconCount", beaconCount)
    sendEvent(EVENT_SYNC_LIFECYCLE, payload)
  }

  override fun onSyncCompleted(beaconCount: Int, success: Boolean, error: Exception?) {
    val payload = Arguments.createMap()
    payload.putString("type", "completed")
    payload.putInt("beaconCount", beaconCount)
    payload.putBoolean("success", success)
    payload.putString("error", error?.message)
    sendEvent(EVENT_SYNC_LIFECYCLE, payload)
  }

  override fun onBeaconDetectedInBackground(beaconCount: Int) {
    val payload = Arguments.createMap()
    payload.putInt("beaconCount", beaconCount)
    sendEvent(EVENT_BACKGROUND_DETECTION, payload)
  }

  // Returns the latest content set from JS via setForegroundNotificationContent,
  // or null to keep the default text from ForegroundScanConfig.
  override fun onProvideNotificationContent(beacons: List<Beacon>): NotificationContent? =
    notificationContent

  // v2.4 — Beacon region lifecycle

  override fun onEnterBeaconRegion() {
    val payload = Arguments.createMap()
    payload.putString("type", "enter")
    sendEvent(EVENT_BEACON_REGION, payload)
  }

  override fun onExitBeaconRegion() {
    val payload = Arguments.createMap()
    payload.putString("type", "exit")
    sendEvent(EVENT_BEACON_REGION, payload)
  }

  override fun onActiveScanStateChanged(isActive: Boolean) {
    val payload = Arguments.createMap()
    payload.putBoolean("isActive", isActive)
    sendEvent(EVENT_ACTIVE_SCAN, payload)
  }

  private fun mapUserProperties(args: ReadableMap): UserProperties {
    val internalId = args.getString("internalId")
    val email = args.getString("email")
    val name = args.getString("name")
    val customMap = mutableMapOf<String, String>()

    val rawCustom = args.getMap("customProperties")
    if (rawCustom != null) {
      val iterator = rawCustom.keySetIterator()
      while (iterator.hasNextKey()) {
        val key = iterator.nextKey()
        val value = rawCustom.getString(key)
        if (value != null) {
          customMap[key] = value
        }
      }
    }

    return UserProperties(
      internalId = internalId,
      email = email,
      name = name,
      customProperties = customMap
    )
  }

  private fun mapBeacons(beacons: List<Beacon>): WritableArray {
    val array = Arguments.createArray()
    beacons.forEach { beacon ->
      array.pushMap(mapBeacon(beacon))
    }
    return array
  }

  private fun mapBeacon(beacon: Beacon): WritableMap {
    val map = Arguments.createMap()
    map.putString("uuid", beacon.uuid.toString())
    map.putInt("major", beacon.major)
    map.putInt("minor", beacon.minor)
    map.putInt("rssi", beacon.rssi)
    map.putString("proximity", beacon.proximity.toApiString())
    map.putDouble("accuracy", beacon.accuracy)
    map.putDouble("timestamp", beacon.timestamp.time.toDouble())

    beacon.metadata?.let { metadata ->
      map.putMap("metadata", mapMetadata(metadata))
    }

    beacon.txPower?.let { txPower ->
      map.putInt("txPower", txPower)
    }

    // Android-only beacon fields (no iOS equivalent).
    map.putBoolean("isStale", beacon.isStale)
    beacon.rssiRaw?.let { map.putInt("rssiRaw", it) }
    beacon.rssiSamples?.let { stats ->
      val statsMap = Arguments.createMap()
      statsMap.putInt("count", stats.count)
      statsMap.putInt("min", stats.min)
      statsMap.putInt("max", stats.max)
      statsMap.putDouble("avg", stats.avg)
      statsMap.putDouble("stdDev", stats.stdDev)
      statsMap.putDouble("firstSeen", stats.firstSeen.toDouble())
      statsMap.putDouble("lastSeen", stats.lastSeen.toDouble())
      map.putMap("rssiSamples", statsMap)
    }
    beacon.syncedAt?.let { map.putDouble("syncedAt", it.time.toDouble()) }
    map.putBoolean("alreadySynced", beacon.alreadySynced)

    return map
  }

  private fun mapMetadata(metadata: BeaconMetadata): WritableMap {
    val map = Arguments.createMap()
    map.putString("firmwareVersion", metadata.firmwareVersion)
    map.putInt("batteryLevel", metadata.batteryLevel)
    map.putInt("movements", metadata.movements)
    map.putInt("temperature", metadata.temperature)
    metadata.txPower?.let { map.putInt("txPower", it) }
    metadata.rssiFromBLE?.let { map.putInt("rssiFromBLE", it) }
    metadata.isConnectable?.let { map.putBoolean("isConnectable", it) }
    return map
  }

  private fun sendEvent(name: String, payload: Any) {
    ctx.runOnUiQueueThread {
      ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(name, payload)
    }
  }

  private fun mapToScanPrecision(value: String): ScanPrecision {
    return when (value.lowercase()) {
      "high" -> ScanPrecision.HIGH
      "medium" -> ScanPrecision.MEDIUM
      "low" -> ScanPrecision.LOW
      else -> ScanPrecision.MEDIUM
    }
  }

  private fun mapToMaxQueuedPayloads(value: Int): MaxQueuedPayloads {
    return when (value) {
      50 -> MaxQueuedPayloads.SMALL
      100 -> MaxQueuedPayloads.MEDIUM
      200 -> MaxQueuedPayloads.LARGE
      500 -> MaxQueuedPayloads.XLARGE
      else -> MaxQueuedPayloads.MEDIUM
    }
  }
}
