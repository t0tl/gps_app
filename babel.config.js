module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      [
        "module-resolver",
        {
          // Set the root to the repository root
          root: ["./"],
          alias: {
            // Map the '@' alias to the repository root (or adjust as needed)
            "@": "./"
          }
        }
      ]
    ],
  };
};