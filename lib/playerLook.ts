/**
 * The player's look for in-game presentation (v164): the avatar image the app shows, so a game can dress its pieces
 * in it (Darts prints it on the flights). Presentation only — never sent, scored or verified.
 */
let avatar = "";
export function setPlayerAvatar(src: string) { avatar = src; }
export function playerAvatar() { return avatar; }
