# Bearound SDK Tests

This directory contains comprehensive tests for the Bearound React Native SDK.

## Test Structure

### 📄 `basic.test.ts`
Comprehensive test suite covering all core functionality:

- **SDK Constants & Exports** - Validates public API surface
- **Cross-platform Behavior** - Tests Android vs iOS differences  
- **Permission System** - Validates permission management functions
- **Error Handling** - Tests edge cases and error scenarios
- **Documentation Compliance** - Ensures API matches documentation

## Running Tests

### Local Development

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode
npm test -- --watch

# Run tests with verbose output
npm test -- --verbose

# Run specific test file
npm test -- basic.test.ts
```

### CI/CD Pipeline

Tests are automatically run in GitHub Actions CI pipeline with:
- Coverage reporting
- Quality validation
- Cross-platform compatibility checks
- Build validation dependencies

## Coverage Targets

| Metric    | Threshold |
|-----------|-----------|
| Lines     | 80%       |
| Statements| 75%       |
| Functions | 70%       |
| Branches  | 50%       |

## Test Philosophy

### What We Test
- ✅ **Public API contracts** - Ensure exports match documentation
- ✅ **Cross-platform behavior** - Android vs iOS differences
- ✅ **Type safety** - TypeScript interface compliance
- ✅ **Error handling** - Graceful failure scenarios
- ✅ **Integration points** - Permission system workflows

### What We Don't Test
- ❌ **Native implementation details** - Tested at native layer
- ❌ **Complex mocking scenarios** - Prefer functional tests
- ❌ **UI components** - SDK is headless
- ❌ **Real device behavior** - Covered by E2E tests

## Mock Strategy

Tests use strategic mocking of React Native modules:
- `Platform` - For cross-platform testing
- `PermissionsAndroid` - For Android permission simulation
- `TurboModuleRegistry` - For native module interface testing

## Adding New Tests

When adding new functionality:

1. **Add test cases** to `basic.test.ts` or create new test files
2. **Update coverage** expectations if needed
3. **Document behavior** in test descriptions
4. **Test both platforms** (Android/iOS) where applicable

### Test Naming Convention

```typescript
describe('Feature Name', () => {
  test('should describe expected behavior', () => {
    // Test implementation
  });
});
```

## Debugging Tests

### Common Issues

**Tests fail with "Module not found":**
- Check mock configuration in test files
- Verify import paths are correct

**Coverage too low:**
- Add more test cases covering uncovered branches
- Consider if coverage target is realistic

**Platform-specific failures:**
- Ensure Platform.OS is properly mocked
- Check Android/iOS specific logic paths

### Debug Commands

```bash
# Run tests with Node.js debugging
node --inspect-brk node_modules/.bin/jest --runInBand

# Generate detailed coverage report
npm test -- --coverage --verbose

# Run single test with debug output
npm test -- --testNamePattern="specific test name" --verbose
```

## CI Integration

Tests are integrated into the CI pipeline:

1. **Lint & Type Check** - Code quality validation
2. **Unit Tests** - This test suite with coverage
3. **Test Quality** - Validates test structure and naming
4. **Build Validation** - Ensures tests pass before builds
5. **Final Validation** - Comprehensive success check

The CI will fail if:
- Any test fails
- Coverage thresholds are not met  
- Test files are missing or improperly named
- Build dependencies are not satisfied