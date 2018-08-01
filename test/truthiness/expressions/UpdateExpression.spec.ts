// should correctly update with postfix ++
{
  let c = 0;
  c++;
  !!c;
}

// should correctly update with postfix --
{
  let c = 1;
  c--;
  !c;
}

// should correctly update with prefix ++
{
  let c = 0;
  ++c;
  !!c;
}

// should correctly update with prefix --
{
  let c = 1;
  --c;
  !c;
}
