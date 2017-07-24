// should return string value
typeof '2' === 'string';

// should return string value from variable
{
  let x = '2';
  typeof x === 'string' && x === '2';
}

// should return number value
typeof 44 === 'number';

// should return number value from variable
{
  let x = 44;
  typeof x === 'number' && x === 44;
}

// should return boolean
typeof true === 'boolean';

// should return boolean value from variable
{
  let x = false;
  typeof x === 'boolean' && x === false;
}

// should handle template literal
`42`;
