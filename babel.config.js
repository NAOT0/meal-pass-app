module.exports = function (api) {
  api.cache(true);
  
  const plugins = [
    "nativewind/babel",
    "react-native-reanimated/plugin", // Reanimated plugin has to be listed last.
  ];

  // 本番環境（リリース時）のみconsole.log等のログ出力をすべて除去する
  if (process.env.NODE_ENV === 'production' || process.env.BABEL_ENV === 'production') {
    plugins.unshift('transform-remove-console');
  }

  return {
    presets: ['babel-preset-expo'],
    plugins: plugins,
  };
};
