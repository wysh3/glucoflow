# CodexApp UI attribution

This directory includes an attributed React port of the **DesktopLayout**, **ContentHeader**, **SidebarThreadControls**, and **SidebarMenuRow** presentation from [CodexApp](https://www.npmjs.com/package/@brutalstrikedevs/codexapp/v/0.1.91) by Pavel Voronin and Igor Levochkin. The published package uses Vue. The React port preserves its sidebar and main-region structure, active row styling, resize ranges and mobile breakpoint. GlucoFlow supplies its own destinations, branding, language controls and content. The mobile drawer uses the existing Radix dialog for keyboard focus and dismissal, and the resize handle also accepts keyboard and touch input.

- Source package `@brutalstrikedevs/codexapp@0.1.91`, published Git commit `4471750828acd26c73a8c95a0a733e9643609959`.
- Registry tarball SHA-256 `36f4ed0a05b92ec912fe5c9443a4124ee24e71e88623d368cccc4b7654fe41eb`.
- Compiled Vue presentation `dist/assets/index-DaFfIKeO.js` SHA-256 `0919b22342d66a37117874ba938c2caaf842da28e91f6f84202df160d2a435a1`.
- CSS source `dist/assets/index-8Y1vSwLj.css` SHA-256 `31048213b215db0b69871130d3d03971bae6d1db72790b78193dd7cba1424a52`.

`desktop-layout.css` contains the original scoped light-mode CSS rules selected for the port. `shell-adaptation.css` layers in viewport, safe area, accessibility and application integration rules. The distributed MIT notice is in [LICENSE](./LICENSE) and [the application's public third-party notices](../../../public/third-party/codexapp-LICENSE.txt).
