// functions can now be spelled def!
macro def {
  rule { $name $params $body } => {
    function $name $params $body
  }
}
def add (a, b) {
  return a + b;
}

console.log( add(3, 7) );
exports.one =  "hello";
let var = macro {
    rule { $name:ident = $value:expr } => {
        var $name = $value
    }
 
    rule { {$name:ident (,) ...} = $value:expr } => {
        var object = $value
        $(, $name = object.$name) ...
    }
 
    rule { [$name:ident (,) ...] = $value:expr } => {
        var array = $value, index = 0
        $(, $name = array[index++]) ...
    }
}
 
var o = 0;
 
var [a, b, c] = [1, 2, 3];
 
var {x, y, z} = {x: 1, y: 2, z: 3};
console.log(a,b,c,x,y,z);
