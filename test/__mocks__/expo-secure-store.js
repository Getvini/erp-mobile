// Mock expo-secure-store for Jest Node environment
const store = {};

module.exports = {
  // Constants used in secureStorage.ts
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
  ALWAYS: 'ALWAYS',

  // Methods
  getItemAsync: jest.fn(async (key) => store[key] ?? null),
  setItemAsync: jest.fn(async (key, value) => { store[key] = value; }),
  deleteItemAsync: jest.fn(async (key) => { delete store[key]; }),
  isAvailableAsync: jest.fn(async () => true),
};
