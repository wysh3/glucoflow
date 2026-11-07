# CodexUI conversation provenance

The Care conversation is a React port of the layout and markup shipped in `@brutalstrikedevs/codexapp@0.1.91`. The package metadata identifies upstream git commit `4471750828acd26c73a8c95a0a733e9643609959`. The package archive SHA-256 is `36f4ed0a05b92ec912fe5c9443a4124ee24e71e88623d368cccc4b7654fe41eb`. The vendor directory includes the upstream MIT license. [Published package](https://registry.npmjs.org/@brutalstrikedevs/codexapp/0.1.91).

| Published asset | SHA-256 | Used here |
| --- | --- | --- |
| `ThreadConversation-BpumRxvo.js` | `1ff738f40b1b913745c029640bc6efa3782e8fa40543d1de87e84746dea9ea23` | Ported conversation root, list, item, message row, stack, body and card |
| `ThreadConversation-DeDMyTtO.css` | `fdfeeb475798a8af50c2166dcf5607e9a3bda5978c9be2219bd3697e333c4a37` | Original scoped conversation styles selected and reformatted in `conversation.css` |
| `index-DaFfIKeO.js` | `0919b22342d66a37117874ba938c2caaf842da28e91f6f84202df160d2a435a1` | Ported content root, thread, empty state and composer form, shell, input and action rows |
| `index-8Y1vSwLj.css` | `31048213b215db0b69871130d3d03971bae6d1db72790b78193dd7cba1424a52` | Original scoped content and composer styles selected and reformatted in `conversation.css` |

The published frontend has no Vue source maps. Its conversation chunk imports the app entry, which mounts the original app and registers its service worker. The composer is internal to that entry. GlucoFlow uses the ported markup and styles with existing authenticated Hermes, speech, evidence, task and approval handlers. Local responsive split-pane and mobile accessibility changes live in `workspace-canvas.css`.
