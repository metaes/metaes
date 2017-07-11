// should return string value
typeof '2' === 'string';

// should return string value from variable
var x = '2';
typeof x === 'string';

// should return number value
typeof 44 === 'number';

// should return number value from variable
{
	let x = 44;
	typeof x === 'number';
}

// should return boolean
typeof true === 'boolean';

// should return boolean value from variable
{
	let x = false;
	typeof x === 'boolean';
}
