module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    'react-native-worklets/plugin',
    // Reanimated plugin MUST be listed last
    'react-native-reanimated/plugin',
  ],
};
