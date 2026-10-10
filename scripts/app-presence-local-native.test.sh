#!/usr/bin/env bash
# Integration test for the opt-in local native artifacts (scripts/app-presence-local-native.sh).
# Builds for real: Gradle (module + example host), CocoaPods (example host). Needs the yarn
# dependencies installed, CocoaPods, a JDK, the Android SDK (ANDROID_HOME) and the two native
# checkouts that carry the app presence API.
#
# Usage: scripts/app-presence-local-native.test.sh [--android-sdk PATH] [--ios-sdk PATH]
#   (defaults: BEAROUND_ANDROID_SDK_PATH / BEAROUND_IOS_SDK_PATH, then the workspace siblings)
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE="$(cd "$ROOT/.." && pwd)"
ANDROID_SDK="${BEAROUND_ANDROID_SDK_PATH:-$WORKSPACE/bearound-android-sdk}"
IOS_SDK="${BEAROUND_IOS_SDK_PATH:-$WORKSPACE/bearound-ios-sdk}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --android-sdk) ANDROID_SDK="$2"; shift 2 ;;
    --ios-sdk) IOS_SDK="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
unset BEAROUND_APP_PRESENCE_LOCAL BEAROUND_NATIVE_AAR_PATH BEAROUND_IOS_SDK_PATH BEAROUND_ANDROID_SDK_PATH
export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"

SCRIPT="$ROOT/scripts/app-presence-local-native.sh"
EXAMPLE="$ROOT/example"
MODULE=":bearound_react-native-sdk"
APP_PRESENCE_CLASS="io/bearound/sdk/models/AppPresenceConfiguration.class"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASSED=0
FAILED=0
pass() { PASSED=$((PASSED + 1)); echo "ok - $1"; }
fail() { FAILED=$((FAILED + 1)); echo "not ok - $1"; [[ -n "${2:-}" ]] && sed 's/^/    /' "$2" | tail -20; }

RN_PODS="$(cd "$EXAMPLE" && node -p 'require.resolve("react-native/scripts/react_native_pods.rb")' 2>/dev/null)"
[[ -f "$RN_PODS" ]] || { echo "react-native is not installed: run yarn install first" >&2; exit 1; }

# Release pins as declared in the build files (the values the default build must resolve).
ANDROID_PIN="$(grep -oE "bearound-android-sdk:v?[0-9.]+" "$ROOT/android/build.gradle" | head -1 | sed -E 's/.*:v?//')"
IOS_PIN="$(grep -oE 's\.dependency "BearoundSDK", "[0-9.]+"' "$ROOT/BearoundReactSdk.podspec" | head -1 | grep -oE '[0-9.]+"$' | tr -d '"')"
[[ -n "$ANDROID_PIN" && -n "$IOS_PIN" ]] || { echo "could not read the release pins" >&2; exit 1; }

gradle_host() { (cd "$EXAMPLE/android" && ./gradlew -q "$@"); }

# The module podspec uses React Native helpers, so `pod ipc spec` needs them preloaded.
cat > "$TMP/rn-pods.rb" <<RUBY
require 'cocoapods'
require '$RN_PODS'
RUBY
podspec_json() { (cd "$ROOT" && RUBYOPT="-r$TMP/rn-pods.rb" pod ipc spec BearoundReactSdk.podspec); }

# Prints the classes jars on the module compile classpath and on the host runtime classpath.
cat > "$TMP/classpath.gradle" <<'GRADLE'
def bearoundClassesJars(project, String configuration) {
    project.configurations.getByName(configuration).incoming.artifactView {
        attributes { attribute(Attribute.of('artifactType', String), 'android-classes-jar') }
    }.files
}
gradle.projectsEvaluated { g ->
    def module = g.rootProject.findProject(':bearound_react-native-sdk')
    if (module == null) return
    def app = g.rootProject.findProject(':app')
    module.tasks.register('printBearoundCompileClasspath') {
        def jars = bearoundClassesJars(module, 'debugCompileClasspath')
        doLast { jars.each { println "CP=${it}" } }
    }
    app.tasks.register('printBearoundRuntimeClasspath') {
        def jars = bearoundClassesJars(app, 'debugRuntimeClasspath')
        doLast { jars.each { println "CP=${it}" } }
    }
}
GRADLE

classpath_has_app_presence() {
  local jar
  while read -r jar; do
    unzip -Z1 "$jar" > "$TMP/jar.txt" 2>/dev/null && grep -qx "$APP_PRESENCE_CLASS" "$TMP/jar.txt" && return 0
  done < <(sed -n 's/^CP=//p' "$1")
  return 1
}

# Old published artifacts: an AAR and an iOS checkout without the app presence API.
mkdir -p "$TMP/old-aar/io/bearound/sdk" "$TMP/old-ios/BearoundSDK"
printf 'old' > "$TMP/old-aar/io/bearound/sdk/BeAroundSDK.class"
(cd "$TMP/old-aar" && zip -qr classes.jar io && printf '<manifest package="io.bearound.sdk"/>' > AndroidManifest.xml && zip -q old.aar classes.jar AndroidManifest.xml)
OLD_AAR="$TMP/old-aar/old.aar"
cp "$IOS_SDK/BearoundSDK.podspec" "$TMP/old-ios/"

echo "# default (BEAROUND_APP_PRESENCE_LOCAL unset): release pins android=$ANDROID_PIN ios=$IOS_PIN"
gradle_host -I "$TMP/classpath.gradle" "$MODULE:printBearoundCompileClasspath" > "$TMP/default-cp.txt" 2>&1
if grep -q "bearound-android-sdk-v$ANDROID_PIN" "$TMP/default-cp.txt" && ! grep -q "sdk-debug.aar" "$TMP/default-cp.txt"; then
  pass "default: module compiles against published bearound-android-sdk v$ANDROID_PIN"
else
  fail "default: module compiles against published bearound-android-sdk v$ANDROID_PIN" "$TMP/default-cp.txt"
fi
podspec_json > "$TMP/default-spec.json" 2>&1
if ruby -rjson -e 'exit(JSON.parse(File.read(ARGV[0]))["dependencies"]["BearoundSDK"] == [ARGV[1]] ? 0 : 1)' "$TMP/default-spec.json" "$IOS_PIN"; then
  pass "default: podspec requires BearoundSDK $IOS_PIN"
else
  fail "default: podspec requires BearoundSDK $IOS_PIN" "$TMP/default-spec.json"
fi
(cd "$EXAMPLE/ios" && pod ipc podfile "$EXAMPLE/ios/Podfile") > "$TMP/default-podfile.yml" 2>&1
if grep -q "BearoundReactSdk" "$TMP/default-podfile.yml" && ! grep -q "BearoundSDK" "$TMP/default-podfile.yml"; then
  pass "default: example Podfile adds no local BearoundSDK pod"
else
  fail "default: example Podfile adds no local BearoundSDK pod" "$TMP/default-podfile.yml"
fi

echo "# override: local native artifacts"
if "$SCRIPT" --android-sdk "$ANDROID_SDK" --ios-sdk "$IOS_SDK" > "$TMP/env.sh" 2> "$TMP/script.log"; then
  pass "script builds the native AAR and exports the override"
else
  fail "script builds the native AAR and exports the override" "$TMP/script.log"
  echo "1..$((PASSED + FAILED))"; echo "# passed $PASSED, failed $FAILED"; exit 1
fi
# shellcheck disable=SC1091
source "$TMP/env.sh"

gradle_host -I "$TMP/classpath.gradle" "$MODULE:printBearoundCompileClasspath" > "$TMP/local-cp.txt" 2>&1
if classpath_has_app_presence "$TMP/local-cp.txt" && ! grep -q "bearound-android-sdk-v" "$TMP/local-cp.txt"; then
  pass "override: module compile classpath has the app presence API and no published native SDK"
else
  fail "override: module compile classpath has the app presence API and no published native SDK" "$TMP/local-cp.txt"
fi
gradle_host "$MODULE:dependencies" --configuration releaseRuntimeClasspath > "$TMP/local-deps.txt" 2>&1
if grep -q "androidx.work:work-runtime-ktx" "$TMP/local-deps.txt" && ! grep -q "com.github.Bearound:bearound-android-sdk" "$TMP/local-deps.txt"; then
  pass "override: published bearound-android-sdk is not resolved; native transitive deps declared"
else
  fail "override: published bearound-android-sdk is not resolved; native transitive deps declared" "$TMP/local-deps.txt"
fi
gradle_host -I "$TMP/classpath.gradle" "$MODULE:compileDebugKotlin" ":app:compileDebugKotlin" ":app:printBearoundRuntimeClasspath" > "$TMP/host.txt" 2>&1
if classpath_has_app_presence "$TMP/host.txt" && ! grep -q "bearound-android-sdk-v" "$TMP/host.txt"; then
  pass "override: module and host compile; host runtime packages the local app presence classes"
else
  fail "override: module and host compile; host runtime packages the local app presence classes" "$TMP/host.txt"
fi
# pod install rewrites a few tracked example files (React Native post-install); put back the
# ones that were clean before so the test leaves the checkout as it found it.
TRACKED="$(cd "$ROOT" && git ls-files -- example/ios | sort)"
DIRTY_BEFORE="$(cd "$ROOT" && git diff --name-only -- example/ios | sort)"
(cd "$EXAMPLE/ios" && pod install) > "$TMP/pod.log" 2>&1
if grep -qF "BearoundSDK (from \`$BEAROUND_IOS_SDK_PATH\`)" "$EXAMPLE/ios/Podfile.lock" \
  && grep -q "AppPresence.swift" "$EXAMPLE/ios/Pods/Pods.xcodeproj/project.pbxproj"; then
  pass "override: pod install resolves BearoundSDK from the local checkout with the app presence API"
else
  fail "override: pod install resolves BearoundSDK from the local checkout with the app presence API" "$TMP/pod.log"
fi
DIRTY_AFTER="$(cd "$ROOT" && git diff --name-only -- example/ios | sort)"
TOUCHED="$(comm -13 <(echo "$DIRTY_BEFORE") <(echo "$DIRTY_AFTER") | comm -12 - <(echo "$TRACKED"))"
[[ -n "$TOUCHED" ]] && (cd "$ROOT" && echo "$TOUCHED" | xargs git checkout --)

echo "# override rejects the old published artifacts"
if "$SCRIPT" --aar "$OLD_AAR" --ios-sdk "$IOS_SDK" > /dev/null 2> "$TMP/reject-script.log"; then
  fail "script rejects an AAR without the app presence API"
else
  grep -q "does not contain the app presence API" "$TMP/reject-script.log" \
    && pass "script rejects an AAR without the app presence API" \
    || fail "script rejects an AAR without the app presence API" "$TMP/reject-script.log"
fi
if BEAROUND_NATIVE_AAR_PATH="$OLD_AAR" gradle_host "$MODULE:help" > "$TMP/reject-gradle.log" 2>&1; then
  fail "Gradle rejects an AAR without the app presence API"
else
  grep -q "does not contain the app presence API" "$TMP/reject-gradle.log" \
    && pass "Gradle rejects an AAR without the app presence API" \
    || fail "Gradle rejects an AAR without the app presence API" "$TMP/reject-gradle.log"
fi
if env -u BEAROUND_NATIVE_AAR_PATH bash -c 'cd "$1" && ./gradlew -q "$2:help"' _ "$EXAMPLE/android" "$MODULE" > "$TMP/reject-missing.log" 2>&1; then
  fail "Gradle rejects the override without an explicit AAR path"
else
  grep -q "requires BEAROUND_NATIVE_AAR_PATH" "$TMP/reject-missing.log" \
    && pass "Gradle rejects the override without an explicit AAR path" \
    || fail "Gradle rejects the override without an explicit AAR path" "$TMP/reject-missing.log"
fi
if BEAROUND_IOS_SDK_PATH="$TMP/old-ios" podspec_json > "$TMP/reject-pod.log" 2>&1; then
  fail "podspec rejects an iOS checkout without the app presence API"
else
  grep -q "does not contain the app presence API" "$TMP/reject-pod.log" \
    && pass "podspec rejects an iOS checkout without the app presence API" \
    || fail "podspec rejects an iOS checkout without the app presence API" "$TMP/reject-pod.log"
fi

echo "1..$((PASSED + FAILED))"
echo "# passed $PASSED, failed $FAILED"
[[ $FAILED -eq 0 ]]
