export {};

import { add, divide, multiply, subtract } from "./functions/math";

function start() {
  const a = add(1, 2);
  const b = divide(1, 2);
  const c = multiply(1, 2);
  const d = subtract(1, 2);

  console.log(a, b, c, d);
}

start();
