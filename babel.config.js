/**
 * Release builds drop every console call, its message included, so the
 * bundle inside the APK carries no log text and logcat stays quiet.
 * Development builds and tests keep their logs.
 */
function removeConsole({ types: t }) {
  return {
    visitor: {
      CallExpression(path) {
        const callee = path.get("callee");
        if (!callee.isMemberExpression() || !callee.get("object").isIdentifier({ name: "console" })) return;
        if (path.parentPath.isExpressionStatement()) path.parentPath.remove();
        else path.replaceWith(t.unaryExpression("void", t.numericLiteral(0)));
      },
    },
  };
}

module.exports = function (api) {
  const release = api.caller((caller) => caller?.isDev === false);
  return {
    presets: ["babel-preset-expo"],
    plugins: release ? [removeConsole] : [],
  };
};
