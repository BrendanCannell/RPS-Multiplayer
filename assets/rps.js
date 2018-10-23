
// Initialize Firebase
var config = {
  apiKey: "AIzaSyD8fjUo8I5eomYC7AP3nDKTZttLyduPOI4",
  authDomain: "rps-multiplayer-b6f5f.firebaseapp.com",
  databaseURL: "https://rps-multiplayer-b6f5f.firebaseio.com",
  projectId: "rps-multiplayer-b6f5f",
  storageBucket: "rps-multiplayer-b6f5f.appspot.com",
  messagingSenderId: "818557079395"
};
firebase.initializeApp(config);

let db = firebase.database();

// Generate a unique ID for the session.
let myId = db.ref().push().key;

// This view of the database is kept updated by a Firebase listener below. It's mainly a syntactic convenience so I can avoid using lots of awkward Firebase API calls.
var view = {
  myGameId: null,
  currentRound: null,
  opponentId: null,
  opponentConnected: null,
  results: null,
  canMove: null,
  messages: null,
};

// The only stateful bit that isn't part of the database is the message input form.
var state = {
  inputVal: ''
}

// Helper to convert a snapshot of a map with ordered keys into an array.
function snapToArray(snap) {
  var arr = [];

  snap.forEach(function (childSnap) {
    var next = childSnap.val();
    next.key = childSnap.key;

    arr.push(next);
  });

  return arr;
};



// Actions

// If conditions allow, start a game.
// But do garbage collection first.
function startGame() {
  return db.ref().transaction((maybeDbVal) => {
    let dbVal = maybeDbVal || {};
    dbVal.players = dbVal.players || {};
    dbVal.games = dbVal.games || {};

    // Garbage collection
    // Games are deleted unless at least one participating player is connected
    for (let gameId of Object.keys(dbVal.games)) {
      let player1 = dbVal.players[dbVal.games[gameId].player1];
      let player2 = dbVal.players[dbVal.games[gameId].player2];

      if (!player1 && !player2) {
        delete dbVal.games[gameId];
      }
    }

    let isGameInProgress = Object.keys(dbVal.games).length > 0;
    let playerIds = Object.keys(dbVal.players);
    let enoughPlayers = playerIds.length >= 2;

    // If no game is in progress and at least two players are available, the two players who joined earliest are matched up in a new game.
    if (!isGameInProgress && enoughPlayers) {
      dbVal.games[db.ref().push().key] = {
        player1: playerIds[0],
        player2: playerIds[1]
      }
    }

    return dbVal;
  })
}

function endGame() {
  db.ref('games').child(view.myGameId).remove();
}

function pushMove(move) {
  db.ref('games').child(view.myGameId).child('rounds').child(view.currentRound).child(myId).set(move);
}

function pushMessage(message) {
  db.ref('games').child(view.myGameId).child('messages').push({ player: myId, message });
}



// Derived data

// The ID of the game we're currently playing, if any, otherwise null.
function myGameId(gamesSnap) {
  let myGame = snapToArray(gamesSnap).find((game) => game.player1 === myId || game.player2 === myId);

  return myGame && myGame.key;
}

// The ID of whomever we're playing against.
function opponentId(gameSnap) {
  let game = gameSnap.val();

  return game.player1 === myId ? game.player2 : game.player1;
}

// An array of all the rounds for which both players have moved.
function completedRounds(gameSnap) {
  let game = gameSnap.val();

  return snapToArray(gameSnap.child('rounds'))
    .filter((round) => round[game.player1] && round[game.player2]);
}

// The current round is the first for which at least one player has not moved yet. Since rounds are counted from zero, that's the same as the number of completed rounds.
function currentRoundIndex(gameSnap) {
  return completedRounds(gameSnap).length;
}

// We can move if we haven't already moved during the current round.
function canMove(gameSnap) {
  let alreadyMoved = gameSnap.child('rounds').child(currentRoundIndex(gameSnap)).child(myId).val();

  return !alreadyMoved;
}

function result(myMove, opponentsMove) {
  let beats = {
    rock: 'scissors',
    paper: 'rock',
    scissors: 'paper'
  }

  if (beats[myMove] === opponentsMove) {
    return 'win';
  } else if (beats[opponentsMove] === myMove) {
    return 'lose';
  } else {
    return 'tie';
  }
}

function lastResult(gameSnap) {
  let completed = completedRounds(gameSnap);

  if (completed.length === 0) {
    return null;
  } else {
    let lastRound = completed[completed.length - 1];

    return result(lastRound[myId], lastRound[opponentId(gameSnap)]);
  }
}

// Total rounds won, lost, and tied
function allResults(gameSnap) {
  var results = {
    win: 0,
    lose: 0,
    tie: 0
  }

  let opponent = opponentId(gameSnap);
  completedRounds(gameSnap).forEach((round) =>
    results[result(round[myId], round[opponent])]++);

  return results;
}



// UI

function render() {
  if (view.myGameId) {
    $('#app').empty().append(
      view.lastResult && $('<div>').text('Last round: ' + view.lastResult),
      $('<div>').text("Wins: " + view.results.win),
      $('<div>').text("Losses: " + view.results.lose),
      $('<div>').text("Ties: " + view.results.tie),
      $('<ul id="messages">').append(view.messages.map((m) =>
        $('<li class="message">')
          .addClass(m.player === myId ? 'me' : 'opponent')
          .text(m.message))));

    if (view.opponentConnected) {
      $('<form>').append(
        $('<input type="text" id="new-message" placeholder="Enter a message...">')
          .val(state.inputVal)
          .on('change', (e) => state.inputVal = $('#new-message').val()),
        $('<input type="submit" value="Send">')
      ).on('submit', (e) => {
        e.preventDefault();

        pushMessage($('#new-message').val().trim());
        $('#new-message').val('');
      }).appendTo($('#app'));
    } else {
      $('<form>').append(
        $('<input type="submit" value="Opponent Disconnected - Play Again?">')
      ).on('submit', (e) => { e.preventDefault(); endGame(); }).appendTo($('#app'));
    }
  } else {
    $('#app').empty().text('Waiting to start...');
  }
}

document.body.addEventListener('keydown', (e) => {
  db.ref('games').once('value').then((snap) => {
    if (view.canMove) {
      switch (e.key) {
        case 'r': pushMove('rock'); break;
        case 'p': pushMove('paper'); break;
        case 's': pushMove('scissors'); break;
      }
    }
  })
});



// Establish Firebase listeners

// Every time we (re)connect, we first arrange to be removed after disconnecting. Only then do we mark ourselves connected.
db.ref('.info/connected').on('value', (snap) => {
  if (snap.val()) {
    let meRef = db.ref('players').child(myId);

    meRef.onDisconnect().remove()
      .then(() => meRef.set(true));
  }
});

// Keep `view` synced to the DB.
db.ref().on('value', (snap) => {
  view.myGameId = myGameId(snap.child('games'));

  if (view.myGameId) {
    let gameSnap = snap.child('games').child(view.myGameId);
    let game = gameSnap.val();

    view.currentRound = currentRoundIndex(gameSnap);
    view.opponentId = opponentId(gameSnap);
    view.opponentConnected = snap.child('players').child(view.opponentId).val() ? true : false;
    view.lastResult = lastResult(gameSnap);
    view.results = allResults(gameSnap);
    view.canMove = canMove(gameSnap);
    view.messages = snapToArray(gameSnap.child('messages'));
  } else {
    view.currentRound = null;
    view.opponentId = null;
    view.opponentConnected = null;
    view.results = null;
    view.canMove = null;
    view.messages = null;
  }

  render();
})

// If we're not currently in a game, players joining and games ending are chances to start a new game.
db.ref('players').on('child_added', () => {
  if (!view.myGameId) startGame();
})
db.ref('games').on('child_removed', () => {
  if (!view.myGameId) startGame();
})