let productosEnCarrito = JSON.parse(localStorage.getItem("productos-en-carrito"));


const contenedorCarritoVacio = document.querySelector("#carrito-vacio");
const contenedorCarritoProductos = document.querySelector("#carrito-productos");
const contenedorCarritoAcciones = document.querySelector("#carrito-acciones");
const contenedorCarritoComprado = document.querySelector("#carrito-comprado");
let botonesElimianar = document.querySelectorAll(".carrito-producto-eliminar")

function cargarProductosCarrito(){
        if(productosEnCarrito){

            contenedorCarritoVacio.classList.add("disabled");
            contenedorCarritoProductos.classList.add("disabled");
            contenedorCarritoAcciones.classList.remove("disabled");
            contenedorCarritoComprado.classList.add("disabled");

            contenedorCarritoProductos.innerHTML="";

            productosEnCarrito.forEach(producto => {
            
                const div = document.createElement("div");
                    div.classList.add("carrito-producto");
                    div.innerHTML=`
                        <img class="carrito-producto-imagen" src="${producto.imagen}" alt="${producto.titulo}">
                                    <div class="carrito-producto-titulo">
                                        <small>Titulo</small>
                                        <h3>${producto.titulo}</h3>
                                    </div>
                                    <div class="carrito-producto-cantidad">
                                        <small>cantidad</small>
                                        <p>${producto.cantidad}</p>
                                    </div>
                                    <div class="carrito-producto-precio">
                                        <small>Precio</small>
                                        <p>${producto.precio}</p>
                                    </div>
                                    <div class="carrito-producto-subtotal">
                                        <small>Subtotal</small>
                                        <p>${producto.precio * producto.cantidad}</p>
                                    </div>
                                    <button class="carrito-producto-eliminar"   id="${producto.id}">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </div>
                    `;

                contenedorCarritoProductos.append(div);
            })
        }else{
                contenedorCarritoVacio.classList.remove("disabled");
                contenedorCarritoProductos.classList.add("disabled");
                contenedorCarritoAcciones.classList.add("disabled");
                contenedorCarritoComprado.classList.add("disabled");
        }
    actualizarBotonesEliminar();
}
cargarProductosCarrito();


function actualizarBotonesEliminar(){
        botonesEliminar = document.querySelectorAll(".carrito-producto-eliminar"); 
        botonesEliminar.forEach(boton =>{
            boton.addEventListener("click", eliminarDelCarrito);
        });
}


function eliminarDelCarrito(e){
    const idBoton = e.currentTarget.id;
    const index = productosEnCarrito.findIndex(producto=> producto.id === idBoton);
    productosEnCarrito.splice(index,1)  //se elimina 1 solo a a la vez 
    cargarProductosCarrito(); // volvemos a cargar el carrito para ver lo que no eliminamos 
    localStorage.setItem("productos-en-carrito", JSON.stringify(productosEnCarrito));
}