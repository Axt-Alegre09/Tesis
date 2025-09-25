function contarHastaCero(numero){
    if(numero>0){
        contarHastaCero(numero-1);
        console.log(numero)
    }
    //console.log(numero)
}

contarHastaCero(10);
console.log(`hola que tal`);