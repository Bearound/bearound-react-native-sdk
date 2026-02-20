# Guia de Release - @bearound/react-native-sdk

## Pre-requisitos

Antes de publicar o React Native SDK, os SDKs nativos **precisam estar publicados** na versao desejada:

| SDK | Registry | Repositorio |
|-----|----------|-------------|
| Android (`bearound-android-sdk`) | [JitPack](https://jitpack.io/#Bearound/bearound-android-sdk) | `../bearound-android-sdk` |
| iOS (`BearoundSDK`) | [CocoaPods](https://cocoapods.org/pods/BearoundSDK) | `../bearound-ios-sdk` |

### Verificar disponibilidade dos SDKs nativos

```bash
# Android - verificar no JitPack (usar tag SEM prefixo "v")
curl -s https://jitpack.io/api/builds/com.github.Bearound/bearound-android-sdk/<VERSION>

# iOS - verificar no CocoaPods
curl -s https://trunk.cocoapods.org/api/v1/pods/BearoundSDK | python3 -m json.tool
```

### GitHub Secrets necessarios

| Secret | Descricao |
|--------|-----------|
| `NPM_TOKEN` | Token de Automation do npm (nao pode ser Publish, senao pede OTP) |
| `CODECOV_TOKEN` | Token do Codecov para coverage |

> O `NPM_TOKEN` **deve** ser do tipo **Granular Access Token** ou **Automation** no [npmjs.com](https://www.npmjs.com/settings/~/tokens). Tokens do tipo Publish exigem OTP e falham na CI.

---

## Passo a passo

### 1. Atualizar dependencias nativas

Editar **3 arquivos**:

#### `package.json` - versao do pacote
```json
"version": "X.Y.Z"
```

#### `android/build.gradle` - SDK Android (JitPack)
```groovy
implementation 'com.github.Bearound:bearound-android-sdk:X.Y.Z'
```
> **Importante**: usar a tag **sem** prefixo `v` (ex: `2.3.5`, nao `v2.3.5`). O JitPack tem problemas de cache com tags que usam o prefixo `v`.

#### `BearoundReactSdk.podspec` - SDK iOS (CocoaPods)
```ruby
s.dependency "BearoundSDK", "~> X.Y.Z"
```

### 2. Deletar Podfile.lock do example (se existir)

```bash
rm -f example/ios/Podfile.lock
```

O `Podfile.lock` trava a versao do `BearoundSDK`. Ao atualizar a dependencia no podspec, ele precisa ser regenerado.

### 3. Commit e push

```bash
git add package.json android/build.gradle BearoundReactSdk.podspec
git add example/ios/Podfile.lock  # se foi deletado

git commit -m "chore: bump to vX.Y.Z, update native SDK dependencies"
git push origin main
```

> Os commits devem seguir o formato [Conventional Commits](https://www.conventionalcommits.org/) (ex: `chore:`, `feat:`, `fix:`). O hook `commitlint` rejeita mensagens fora do padrao.

### 4. Criar e enviar a tag

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

Isso aciona automaticamente o workflow **CI/CD** (`.github/workflows/ci-cd.yaml`) que executa:

1. Lint + Typecheck
2. Testes unitarios
3. Build da library
4. Build Android (example app)
5. Build iOS (example app)
6. **Publish no npm**

### 5. Acompanhar o workflow

Acessar: `https://github.com/Bearound/bearound-react-native-sdk/actions`

---

## Publicacao manual (sem CI)

Caso precise publicar manualmente:

```bash
# Build
yarn prepare

# Publicar
npm publish --access public
```

> Se o npm pedir OTP, o token configurado e do tipo errado. Gere um **Automation token**.

---

## Troubleshooting

### JitPack: "Could not find bearound-android-sdk:vX.Y.Z"

O JitPack cacheia resultados "not found". Solucoes:

1. **Usar tag sem prefixo `v`**: trocar `v2.3.5` por `2.3.5` no `build.gradle`
2. **Verificar se a tag existe no repo Android**: `git ls-remote --tags origin | grep X.Y.Z`
3. **Acionar build manualmente**: acessar `https://jitpack.io/#Bearound/bearound-android-sdk` e clicar "Get it" na versao desejada
4. **Verificar build log**: `https://jitpack.io/com/github/Bearound/bearound-android-sdk/X.Y.Z/build.log`

### CocoaPods: "None of your spec sources contain a spec satisfying the dependency"

O pod `BearoundSDK` ainda nao foi publicado ou o CDN nao sincronizou:

1. **Verificar se o pod existe**: `curl -s https://trunk.cocoapods.org/api/v1/pods/BearoundSDK`
2. **Aguardar propagacao**: apos `pod trunk push`, pode levar alguns minutos para o CDN atualizar
3. **Re-rodar o workflow**: se o pod ja foi publicado, basta re-rodar o job `build-ios`

### npm: "EOTP - This operation requires a one-time password"

O `NPM_TOKEN` no GitHub Secrets e do tipo **Publish** (exige OTP). Trocar por um **Automation token**:

1. Acessar [npmjs.com/settings/~/tokens](https://www.npmjs.com/settings/~/tokens)
2. Gerar **Granular Access Token** com permissao Read/Write no pacote `@bearound/react-native-sdk`
3. Atualizar o secret `NPM_TOKEN` no GitHub

### npm: "Cannot publish over previously published version"

Uma versao ja publicada no npm **nao pode ser republicada**, mesmo apos `npm unpublish`. Faca bump para a proxima versao.

### Podfile.lock desatualizado

Se o build iOS falhar com conflito de versao no `Podfile.lock`:

```bash
rm example/ios/Podfile.lock
git add example/ios/Podfile.lock
git commit -m "fix: remove stale Podfile.lock"
```

---

## Ordem de release entre SDKs

Ao atualizar todos os SDKs Bearound, seguir esta ordem:

```
1. bearound-android-sdk  ->  publicar tag no GitHub (JitPack builda automaticamente)
2. bearound-ios-sdk      ->  publicar tag no GitHub (CI faz pod trunk push)
3. bearound-react-native-sdk  ->  atualizar deps, tag, CI publica no npm
4. bearound-flutter-sdk  ->  atualizar deps, tag, CI publica no pub.dev
```

> Sempre aguardar a confirmacao de que os SDKs nativos estao disponiveis (JitPack + CocoaPods) antes de publicar os SDKs wrapper (React Native / Flutter).

---

## Arquivos relevantes

| Arquivo | Funcao |
|---------|--------|
| `package.json` | Versao do pacote npm |
| `android/build.gradle` | Dependencia do Android SDK (JitPack) |
| `BearoundReactSdk.podspec` | Dependencia do iOS SDK (CocoaPods) |
| `example/ios/Podfile.lock` | Lock de pods do example (deletar ao atualizar) |
| `example/android/build.gradle` | Repos do Gradle (inclui JitPack) |
| `example/android/gradle.properties` | Timeout HTTP do Gradle |
| `.github/workflows/ci-cd.yaml` | Workflow de CI/CD (trigger: tag `v*`) |
| `.github/workflows/ci.yml` | Workflow de CI (trigger: PR / push develop) |
