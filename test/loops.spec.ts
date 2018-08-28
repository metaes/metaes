// it: should loop over values;
{
  const input = [1, 2, 3];
  const output = [];
  for (let o of input) {
    // @ts-ignore
    output.push(o);
  }

  input.toString() === output.toString();
}
