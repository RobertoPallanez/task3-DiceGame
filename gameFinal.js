const crypto = require("crypto");
const { sha3_256 } = require("js-sha3");
const { fork } = require("child_process");
const Table = require("cli-table3");
const readline = require("readline");
const BLUE_TEXT = "\x1b[34m";
const RESET = "\x1b[39m";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function randomElement(min, max) {
  const range = max - min + 1;
  const randomKey = crypto.randomBytes(32).toString("hex").toUpperCase();
  const randomInt = crypto.randomBytes(4).readUInt32BE(0);
  const randomIntResult = min + (randomInt % range);
  const hmacResult = crypto
    .createHmac("sha256", randomKey)
    .update(sha3_256(randomIntResult.toString()))
    .digest("hex")
    .toUpperCase();
  return { randomKey, randomInt: randomIntResult, hmacResult };
}

function calculateWinProbability(die1, die2) {
  let winCount = 0;
  const totalComparisons = die1.length * die2.length;
  // Compare each side of die1 against each side of die2
  for (let i = 0; i < die1.length; i++) {
    for (let j = 0; j < die2.length; j++) {
      if (die1[i] > die2[j]) {
        winCount++; // Die 1 wins
      }
    }
  }

  return winCount / totalComparisons || 0;
}

let currentPage = 1;
const rowsPerPage = 3; // Number of rows per page

function createTable(diceValues) {
  checkTable = true;
  const dice = diceValues.map(parseDieString);
  const numDice = dice.length;

  const rows = [];
  for (let i = 0; i < numDice; i++) {
    const row = [dice[i].join(", ")]; // Display the sides of the current die
    for (let j = 0; j < numDice; j++) {
      if (i === j) {
        row.push(
          `${(1 / dice.length).toFixed(4)} (${
            (1 / dice.length).toFixed(4) * 100
          }%)`
        ); // A die against itself is a 50% chance
      } else {
        const winProbability = calculateWinProbability(dice[i], dice[j]);
        const winPercentage = (winProbability * 100).toFixed(2); // Calculate percentage (rounded to 2 decimal places)
        row.push(`${winProbability.toFixed(4)} (${winPercentage}%)`);
      }
    }

    const coloredRow = row.map((cell, index) => {
      if (index === 0) {
        return `${BLUE_TEXT}${cell}${RESET}`;
      }
      return cell;
    });
    rows.push(coloredRow); // Add the row to the rows array
  }

  const totalPages = Math.ceil(rows.length / rowsPerPage);

  function renderPage() {
    const table = new Table({
      head: ["Die", ...dice.map((die) => die.join(", "))],
      colWidths: Array(numDice + 1).fill(25),
    });

    const start = (currentPage - 1) * rowsPerPage;
    const end = Math.min(start + rowsPerPage, rows.length);

    // Add only the rows for the current page
    rows.slice(start, end).forEach((row) => table.push(row));

    console.clear(); // Clear the console to redraw the table
    console.log();
    console.log(
      "PROBABILITY OF WIN FOR EACH DICE - YOU CAN ACCESS THIS TABLE AT ANY POINT OF THE GAME."
    );
    console.log();
    console.log(
      "The table below shows the dice that were submitted to the game."
    );
    console.log(
      "Look for a dice in the ROWS (Blue) and check its winning probability against the dices in the COLUMNS (red)."
    );
    console.log(table.toString());
    console.log(`Page ${currentPage} of ${totalPages}`);
    console.log();
    rl.question("Choose an option: \n", handleUserInput);
    console.log("n - Next page");
    console.log("p - Previous page");
    console.log("c [number] - Go to page number");
    console.log("x - Finish Game");
    console.log();
    console.log();
    console.log("Press ENTER to Exit table");
  }

  function handleUserInput(input) {
    input = input.trim().toLowerCase();

    if (input.toLowerCase() === "n") {
      if (currentPage < totalPages) {
        currentPage++;
        renderPage();
      } else {
        console.log("You are already on the last page.");
        renderPage();
      }
    } else if (input.toLowerCase() === "p") {
      if (currentPage > 1) {
        currentPage--;
        renderPage();
      } else {
        console.log("You are already on the first page.");
        renderPage();
      }
    } else if (input.startsWith("c ")) {
      const pageNumber = parseInt(input.split(" ")[1]);
      if (pageNumber >= 1 && pageNumber <= totalPages) {
        currentPage = pageNumber;
        renderPage();
      } else {
        console.log("Invalid page number.");
        renderPage();
      }
    } else if (input.toLowerCase() === "x") {
      rl.close();
    } else if (input === "") {
      handleStateChange(); // Trigger the function on ENTER key press (empty input)
    } else {
      console.log("Invalid command.");
      renderPage();
    }
  }

  renderPage(); // Initial call to render the first page
}

function handleStateChange() {
  //   rl.question("Press ENTER to exit the table ", (answerForExit) => {
  switch (currentState) {
    case "picksPhase":
      startGame(diceValues);
      break;

    case "userPicksFirst":
      userPicksFirst(diceValues, stateArguments.randomObject);
      break;

    case "computerPicksFirst":
      computerPicksFirst(diceValues, stateArguments.randomObject);
      break;

    case "userSelectModulo1":
      userFirstModulo1(
        diceValues,
        stateArguments.answerForDice,
        stateArguments.randomObject
      );
      break;

    case "compSelectModulo1":
      compFirstModulo1(
        diceValues,
        stateArguments.answerForDice,
        stateArguments.randomDice,
        stateArguments.randomObject
      );
      break;

    case "userPicksFirstModulo1":
      userFirstModulo2(
        stateArguments.userDice,
        stateArguments.randomDice,
        stateArguments.answerForModulo1
      );
      break;

    case "compPicksFirstModulo1":
      compFirstModulo2(
        stateArguments.userDice,
        stateArguments.randomDice,
        stateArguments.answerForModulo1,
        stateArguments.randomObject
      );
      break;
  }
  //   });
}

function parseDieString(dieString) {
  return dieString.split(",").map((num) => parseInt(num.trim(), 10));
}

function restartGame() {
  const child = fork(__filename);
  process.exit();
}

function startGame(dice) {
  currentState = "picksPhase";
  const stringLength = /^(.+)(,.+){5}$/;
  if (!dice.every((str) => stringLength.test(str))) {
    console.log(
      "Please only submit dice with 6 faces each. EXAMPLE: 1,2,2,4,4,6"
    );
    restartGame();
  }
  if (dice.length < 3) {
    console.log(
      `User only specified ${dice.length} dice. Please, specify at least 3 dice.`
    );
    restartGame();
  } else if (dice.length > 2) {
    const regex = /^(\d+)(,\d+)*$/;
    const checkStrings = dice.every((string) => regex.test(string));
    if (checkStrings) {
      let randomObject = randomElement(0, 1);
      console.log(
        "=============================================================="
      );
      console.log("LETS PLAY A DICE GAME!");
      console.log();
      console.log("Lets determine who makes the first move.");
      console.log("I selected a random value in the range 0..1");
      console.log(`(HMAC=${randomObject.hmacResult})`);
      rl.question("Try to guess my selection: ", (answerForTurn) => {
        const validInputs = ["0", "1", "x", "?"];
        const userInput = answerForTurn.trim().toLowerCase(); // Check the full string, not just the first character
        if (!validInputs.includes(userInput)) {
          console.log(
            "Invalid input. Please select from the options: 0, 1, X, ?"
          );
          startGame(dice);
          return;
        }
        if (userInput == "x") {
          restartGame();
        } else if (userInput == "?") {
          createTable(diceValues);
        } else {
          console.log(`Your selection: ${userInput}`);
          console.log(
            `My selection: ${randomObject.randomInt} (KEY=${randomObject.randomKey}).`
          );
          Object.assign(stateArguments, randomObject, {
            answerForTurn: userInput,
            randomKey: randomObject.randomKey,
            hmac: randomObject.hmacResult,
            randomInt: randomObject.randomInt,
          });
          checkTable = false;
          if (userInput == randomObject.randomInt) {
            userPicksFirst(dice, randomObject);
          } else {
            computerPicksFirst(dice, randomObject);
          }
        }
      });
      console.log();
      console.log("0 - 0");
      console.log("1 - 1");
      console.log("X - exit");
      console.log("? - help");
    } else {
      console.log(
        "Please, for the dice values, only type numbers separated with comma, not letters, symbols or blank spaces. EXAMPLE. 1,2,3,4,5,6"
      );
      restartGame();
    }
  }
}

function userPicksFirst(dice, randomObject) {
  currentState = "userPicksFirst";
  // Create an array of valid options: indices of dice, 'X', and '?'
  const validOptions = dice.map((_, index) => index.toString());
  validOptions.push("x", "?");
  // Function to handle user input
  const handleInput = (answerForDice) => {
    // Normalize input to lowercase
    const normalizedInput = answerForDice.toLowerCase();
    // If the input is "x", restart the game
    if (normalizedInput === "x") {
      restartGame();
    } else if (normalizedInput === "?") {
      createTable(diceValues);
    } else if (validOptions.includes(normalizedInput)) {
      checkTable = false;
      userFirstModulo1(dice, answerForDice, randomObject);
    } else {
      console.log("Invalid input. Please choose a valid option.");
      promptUser();
    }
  };
  const promptUser = () => {
    console.log("============================================================");
    rl.question("You make the first move, choose your dice: \n", handleInput);
    dice.forEach((die, index) => {
      console.log(`${index} - ${die}`);
    });
    console.log("X - exit");
    console.log("? - help");
  };
  promptUser();
}

function computerPicksFirst(dice, randomObject) {
  currentState = "computerPicksFirst";
  let randomDiceIndex;
  let randomDice;
  if (checkTable == true) {
    randomDice = stateArguments.randomDice;
  } else {
    randomDiceIndex = Math.floor(Math.random() * dice.length);
    randomDice = dice[randomDiceIndex];
  }
  Object.assign(stateArguments, { randomDice: randomDice });
  let newDiceArray = dice.filter((value, index) => index !== randomDiceIndex);
  console.log("============================================================");
  console.log(`I make the first move and choose the [${randomDice}] dice.`);
  Object.assign(stateArguments, { randomDice: randomDice });
  const validOptions = newDiceArray.map((_, index) => index.toString());
  validOptions.push("x", "?");
  const handleInput = (answerForDice) => {
    const normalizedInput = answerForDice.toLowerCase();
    if (normalizedInput === "x") {
      restartGame();
    } else if (normalizedInput === "?") {
      createTable(diceValues);
    } else if (validOptions.includes(normalizedInput)) {
      checkTable = false;
      Object.assign(stateArguments, { answerForDice: answerForDice });
      compFirstModulo1(newDiceArray, answerForDice, randomDice, randomObject);
    } else {
      console.log("Invalid input. Please choose a valid option.");
      promptUser();
    }
  };
  const promptUser = () => {
    rl.question("Choose your dice: \n", handleInput);
    newDiceArray.forEach((die, index) => {
      console.log(`${index} - ${die}`);
    });
    console.log("X - exit");
    console.log("? - help");
  };
  promptUser();
}

function userFirstModulo1(dice, answerForDice, randomObject) {
  currentState = "userSelectModulo1";
  if (checkTable == true) {
    randomObject = stateArguments.randomObject;
    randomObject.hmacResult = stateArguments.hmac;
  } else {
    randomObject = randomElement(0, 5);
  }
  const userDice = dice[answerForDice];
  let newDiceArray = dice.filter((value, index) => index != answerForDice);
  const randomDiceIndex = Math.floor(Math.random() * newDiceArray.length);
  let randomDice;
  if (checkTable == true) {
    randomDice = stateArguments.randomDice;
  } else {
    randomDice = newDiceArray[randomDiceIndex];
  }
  console.log("============================================================");
  console.log(`Your selection: ${answerForDice}`);
  console.log(`You choose the [${userDice}] dice.`);
  console.log(`I choose the [${randomDice}] dice.`);
  console.log(`Its time for your throw.`);
  console.log(`I selected a random value in the range 0..5`);
  console.log(`(HMAC=${randomObject.hmacResult})`);
  Object.assign(
    stateArguments,
    randomObject,
    { randomDice: randomDice },
    { userDice: userDice },
    { answerForDice: answerForDice },
    { hmac: randomObject.hmacResult }
  );
  const validOptions = Array.from({ length: 6 }, (_, i) => i.toString()).concat(
    "x",
    "?"
  );
  const handleInput = (answerForModulo) => {
    if (answerForModulo.toLowerCase() === "x") {
      restartGame();
    } else if (answerForModulo === "?") {
      createTable(diceValues);
    } else if (validOptions.includes(answerForModulo)) {
      checkTable = false;
      userFirstModulo2(userDice, randomDice, answerForModulo);
    } else {
      console.log("Invalid input. Please choose a valid option.");
      promptUser();
    }
  };
  const promptUser = () => {
    rl.question("Add your number modulo 6. \n", handleInput);
    for (let i = 0; i < 6; i++) {
      console.log(`${i} - ${i}`);
    }
    console.log("X - exit");
    console.log("? - help");
  };
  promptUser();
}

function compFirstModulo1(
  newDiceArray,
  answerForDice,
  randomDice,
  randomObject
) {
  currentState = "compSelectModulo1";
  let userDice;
  if (checkTable == true) {
    randomObject = stateArguments.randomObject;
    randomObject.hmacResult = stateArguments.hmac;
    userDice = stateArguments.userDice;
  } else {
    userDice = newDiceArray[answerForDice];
    randomObject = randomElement(0, 5);
    Object.assign(
      stateArguments,
      { randomObject: randomObject },
      { userDice: userDice }
    );
  }
  console.log(`==============================================================`);
  console.log(`Your selection: ${answerForDice}`);
  console.log(`You choose the [${userDice}] dice.`);
  console.log("Its time for my throw.");
  console.log(`I selected a random value in the range 0..5`);
  console.log(`(HMAC=${randomObject.hmacResult}).`);
  const validOptions = Array.from({ length: 6 }, (_, i) => i.toString()).concat(
    "x",
    "?"
  );
  const handleInput = (answerForModulo) => {
    if (answerForModulo.toLowerCase() == "x") {
      restartGame();
    } else if (answerForModulo == "?") {
      createTable(diceValues);
    } else if (validOptions.includes(answerForModulo)) {
      checkTable = false;
      compFirstModulo2(userDice, randomDice, answerForModulo, randomObject);
    } else {
      console.log("Invalid input. Please choose a valid option.");
      promptUser();
    }
  };
  const promptUser = () => {
    rl.question("Add your number modulo 6. \n", handleInput);
    for (let i = 0; i < 6; i++) {
      console.log(`${i} - ${i}`);
    }
    console.log("X - exit");
    console.log("? - help");
  };
  promptUser();
}

function userFirstModulo2(userDice, randomDice, answerForModulo) {
  currentState = "userPicksFirstModulo1";
  const userDiceArray = userDice.split(",");
  let userThrow;
  let randomObject = randomElement(0, 5);
  if (checkTable == true) {
    userThrow = stateArguments.userThrow;
    randomObject.randomInt = stateArguments.randomInt;
    randomObject.randomKey = stateArguments.randomKey;
  } else {
    Object.assign(stateArguments, { userThrow: userThrow });
    stateArguments.randomInt = randomObject.randomInt;
    stateArguments.randomKey = randomObject.randomKey;
    userThrow =
      userDiceArray[(+stateArguments.randomInt + +answerForModulo) % 6];
  }
  console.log(`==============================================================`);
  console.log(`Your selection: ${answerForModulo}`);
  console.log(
    `My number is ${randomObject.randomInt} (KEY=${randomObject.randomKey})`
  );
  console.log(
    `The result is ${stateArguments.randomInt} + ${answerForModulo} = ${
      (+stateArguments.randomInt + +answerForModulo) % 6
    } (mod 6).`
  );
  if (checkTable == true) {
    randomObject.hmacResult = stateArguments.hmac;
  } else {
    randomObject = randomElement(0, 5);
  }
  console.log(`Your throw is ${userThrow}.`);
  console.log("Its time for my throw.");
  console.log("I selected a random value in the range 0..5");
  console.log(`(HMAC=${randomObject.hmacResult})`);
  Object.assign(stateArguments, { randomObject: randomObject });
  const validOptions = Array.from({ length: 6 }, (_, i) => i.toString()).concat(
    "x",
    "?"
  );
  const handleInput = (answerForModulo) => {
    if (answerForModulo.toLowerCase() == "x") {
      restartGame();
    } else if (answerForModulo == "?") {
      createTable(diceValues);
    } else if (validOptions.includes(answerForModulo)) {
      Object.assign(
        stateArguments,
        randomObject,
        { answerForModulo2: answerForModulo },
        { hmac: randomObject.hmacResult },
        { randomKey: randomObject.randomKey },
        { randomInt: randomObject.randomInt },
        { userThrow: userThrow },
        { userDice: userDice },
        { randomDice: randomDice }
      );
      checkTable = false;
      userFirstResult(randomDice, answerForModulo, userThrow, randomObject);
    } else {
      console.log("Invalid input. Please choose a valid option.");
      promptUser();
    }
  };
  const promptUser = () => {
    rl.question("Add your number modulo 6. \n", handleInput);
    for (let i = 0; i < 6; i++) {
      console.log(`${i} - ${i}`);
    }
    console.log("X - exit");
    console.log("? - help");
  };
  promptUser();
}

function compFirstModulo2(userDice, randomDice, answerForModulo, randomObject) {
  Object.assign(stateArguments, { answerForModulo1: answerForModulo });
  currentState = "compPicksFirstModulo1";
  console.log(`==============================================================`);
  const randomDiceArray = randomDice.split(",");
  let computerThrow;
  randomObject = randomElement(0, 5);
  if (checkTable == true) {
    computerThrow = stateArguments.computerThrow;
    randomObject.randomInt = stateArguments.randomInt;
    randomObject.randomKey = stateArguments.randomKey;
  } else {
    computerThrow =
      randomDiceArray[(+randomObject.randomInt + +answerForModulo) % 6];
    Object.assign(stateArguments, { computerThrow: computerThrow });
    stateArguments.randomInt = randomObject.randomInt;
    stateArguments.randomKey = randomObject.randomKey;
  }
  console.log(`Your selection: ${answerForModulo}`);
  console.log(
    `My number is ${randomObject.randomInt} (KEY=${randomObject.randomKey}).`
  );
  console.log(
    `The result is ${randomObject.randomInt} + ${answerForModulo} = ${
      (+randomObject.randomInt + +answerForModulo) % 6
    } (mod 6).`
  );
  if (checkTable == true) {
    randomObject = stateArguments.randomObject;
    randomObject.hmacResult = stateArguments.hmac;
  } else {
    randomObject = randomElement(0, 5);
    Object.assign(stateArguments, { randomObject: randomObject });
  }
  console.log(`My throw is ${computerThrow}.`);
  console.log("Its time for your throw.");
  console.log("I selected a random value in the range 0..5");
  console.log(`(HMAC=${randomObject.hmacResult})`);
  const validOptions = Array.from({ length: 6 }, (_, i) => i.toString()).concat(
    "x",
    "?"
  );
  const handleInput = (answerForModulo) => {
    if (answerForModulo.toLowerCase() == "x") {
      restartGame();
    } else if (answerForModulo == "?") {
      createTable(diceValues);
    } else if (validOptions.includes(answerForModulo)) {
      Object.assign(
        stateArguments,
        randomObject,
        { answerForModulo2: answerForModulo },
        { hmac: randomObject.hmacResult },
        { randomKey: randomObject.randomKey },
        { randomInt: randomObject.randomInt },
        { computerThrow: computerThrow }
      );
      checkTable = false;
      compFirstResult(userDice, answerForModulo, randomObject, computerThrow);
    } else {
      console.log("Invalid input. Please choose a valid option.");
      promptUser();
    }
  };
  const promptUser = () => {
    rl.question("Add your number modulo 6. \n", handleInput);
    for (let i = 0; i < 6; i++) {
      console.log(`${i} - ${i}`);
    }
    console.log("X - exit");
    console.log("? - help");
  };
  promptUser();
}

function userFirstResult(randomDice, answerForModulo, userThrow, randomObject) {
  const computerDiceArray = randomDice.split(",");
  const computerThrow =
    computerDiceArray[(+randomObject.randomInt + +answerForModulo) % 6];
  console.log(`==============================================================`);
  console.log(`Your selection: ${answerForModulo}`);
  console.log(
    `My number is ${randomObject.randomInt} (KEY=${randomObject.randomKey})`
  );
  console.log(
    `The result is ${randomObject.randomInt} + ${answerForModulo} = ${
      (+randomObject.randomInt + +answerForModulo) % 6
    } (mod 6).`
  );
  console.log(`My throw is ${computerThrow}`);

  if (userThrow > computerThrow) {
    console.log(`You win (${userThrow} > ${computerThrow})!`);
  } else if (userThrow == computerThrow) {
    console.log(`Its a Tie (${userThrow} = ${computerThrow})! `);
  } else if (userThrow < computerThrow) {
    console.log(`You lose (${userThrow} < ${computerThrow})!`);
  }
  restartGame();
}

function compFirstResult(
  userDice,
  answerForModulo,
  randomObject,
  computerThrow
) {
  const userDiceArray = userDice.split(",");
  const userThrow =
    userDiceArray[(+randomObject.randomInt + +answerForModulo) % 6];
  console.log(`==============================================================`);
  console.log(`Your selection: ${answerForModulo}`);
  console.log(
    `My number is ${randomObject.randomInt} (KEY=${randomObject.randomKey})`
  );
  console.log(
    `The result is ${randomObject.randomInt} + ${answerForModulo} = ${
      (+randomObject.randomInt + +answerForModulo) % 6
    } (mod 6).`
  );
  console.log(`Your throw is ${userThrow}.`);

  if (userThrow > computerThrow) {
    console.log(`You win (${userThrow} > ${computerThrow})!`);
  } else if (userThrow == computerThrow) {
    console.log(`Its a Tie (${userThrow} = ${computerThrow})! `);
  } else if (userThrow < computerThrow) {
    console.log(`You lose (${userThrow} < ${computerThrow})!`);
  }
  restartGame();
}

const strings = process.argv.slice(2);
const diceValues = strings;
let currentState = "picksPhase";
let stateArguments = {
  randomKey: "",
  hmac: "",
  randomInt: 0,
  userDice: 0,
  randomDice: 0,
  answerForTurn: "",
  answerForDice: "",
  answerForModulo1: "",
  answerForModulo2: "",
  randomObject: {},
  userThrow: "",
  computerThrow: "",
};
let checkTable = false;
startGame(diceValues);
