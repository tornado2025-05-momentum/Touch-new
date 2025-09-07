module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // Use the new Worklets plugin (Reanimated plugin has moved)
    'react-native-worklets/plugin',
  ],
};
