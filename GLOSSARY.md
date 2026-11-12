# Inline Skating Game

A shared-world game centered on aggressive inline skating with a high-tech fantasy style.

## Language

**Aggressive inline skating**:
The game's movement discipline: rollerblading built around momentum, jumps, tricks, wall rides, and grinding, with fantasy high-tech skates.
_Avoid_: Skateboarding

**Shared world**:
The single public skating space that website visitors inhabit together, rather than separate private lobbies.

**Ephemeral gameplay state**:
Temporary information needed for the current shared skating experience, not a stored player profile, progression record, or chat history.

**Visitor**:
An anonymous player with a temporary session identity and appearance, rather than an account or saved profile. Their visitor identity is dropped when they leave or disconnect; reconnecting creates a new visitor.

**Playtest bot**:
An automated skater that roams the district and performs tricks to help evaluate skating routes and world capacity.
_Avoid_: NPC (these bots are test participants, not a promised gameplay feature)

**District**:
A compact, bounded urban skating area with interconnected street-level, elevated, and rooftop routes, offering authored loops and multiple linked paths for combos and transfers.

**Wall ride**:
Deliberately entered trick traversal along a wall that carries existing momentum, with the option to jump away. Without boost it gradually loses height and speed; boost extends travel without eliminating height loss.

**Wall slide**:
Ordinary non-head-on wall contact that lets the skater continue moving along the wall without entering the wall-ride trick.

**Grind**:
Deliberately entered travel along an eligible rail or ledge, automatically balanced so the challenge centers on entry, tricks, transfers, and exit choice.

**Boost**:
Player-activated acceleration available during skating, airborne travel, grinding, and wall riding, which can be combined with tricks to build speed and cross large gaps.

**Tagging**:
A stopped player action that places a shared, temporary graffiti tag on a suitable reachable wall, distinct from graffiti already authored into the district's art. Tags fade away over two minutes, use a curated library rather than player-created designs, and can overlap.

**Tag**:
A temporary, shared graffiti mark chosen from the curated library, potentially including TVHead stickers and artwork with color options. A player can have five active tags; placing another removes their oldest active tag. A tag can outlast its visitor until its two-minute lifetime ends, but cannot trigger a future head-to-head duel against an absent visitor.

**Boost trick**:
A trick performed while holding boost, combining the trick with acceleration.

**Boost reserve**:
The resource spent on ordinary boost and replenished by tricks; it slowly depletes while the player is stopped.

**Combo**:
An uninterrupted chain of tricks that can bridge ordinary skating through a short grace period of at most a few seconds.

**Combo grace period**:
The brief window for linking another trick, grind, or wall ride after landing, before a combo ends normally; a crash breaks the combo.

**Bomb Rush Mode**:
A temporary power-up that activates automatically when long, uninterrupted combos fill its meter, granting unlimited boost for its duration.
