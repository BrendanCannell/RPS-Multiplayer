# rps-multiplayer

It's extra-unpolished this time because group project. Again the R, P, and S keys are the interface. The database has a child `players`, which has keys of all connected players (values are all `true`), and a child `games`. `games` can in principle have many children to allow many games running concurrently, but per the instructions I only allowed one at a time.

Whenever conditions allow (i.e., there are two available players and no game running), a client will match them up in a new game. This matching must be performed in a transaction, along with the garbage collection that precedes it. All other operations can be performed concurrently. The game object consists of keys `player1` and `player2` set to the IDs of the players, and `moves` and `messages` as append-only lists of those things.

If a player disconnects during a game, the game remains live so the other player can continue to view existing messages and results. After the second player disconnects, or chooses to play again, the game is deleted and a new one can begin.

I had fun. Concurrency and distributed systems are fascinating and terrifying. Firebase would be pretty cool if it weren't wed to hierarchical data models, and if it had a system for logical/materialized views.