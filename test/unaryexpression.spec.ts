// it: should delete variable from global environment
{
  var z;
  // @ts-ignore
  delete z;
  typeof z === "undefined";
}
