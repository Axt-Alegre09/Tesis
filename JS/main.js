const productos=[
    //bocaditos
    {
        id:"Bocaditos_Ct_01",
        titulo:"Bocaditos Combo 1",
        imagen:"./img/bocaditos/ServicioCathering1.jpg",
        categoria:{
            nombre:"Bocaditos",
            id:"bocaditos"
        },
        precio:55.000
    },
    {
        id:"Bocaditos_Ct_02",
        titulo:"Bocaditos Combo 2",
        imagen:"./img/bocaditos/ServicioCathering2.jpeg",
        categoria:{
            nombre:"Bocaditos",
            id:"bocaditos"
        },
        precio : 50.0000
    },
    {
        id:"Bocaditos_Ct_03",
        titulo:"Bocaditos Combo 3",
        imagen:"./img/bocaditos/ServicioCathering3.jpeg",
        categoria:{
            nombre:"Bocaditos",
            id:"bocaditos"
        },
        precio:150.000
    },
    {
        id:"Bocaditos_Ct_04",
        titulo:"Bocaditos Combo 4",
        imagen:"./img/bocaditos/ServicioCathering4.jpeg",
        categoria:{
            nombre:"Bocaditos",
            id:"bocaditos"
        },
        precio:75.000
    },
    {
        id:"Bocaditos_Ct_Pareja",
        titulo:"Bocadito en Pareja",
        imagen:"./img/bocaditos/ServicioCatheringPareja.jpg",
        categoria:{
            nombre:"Bocaditos",
            id:"bocaditos"
        },
        precio:65.000
    },
    {
        id:"Bocaditos_Ct_Personal",
        titulo:"Bocadito Personal",
        imagen:"./img/bocaditos/ServicioCatheringPersonal.jpg",
        categoria:{
            nombre:"Bocaditos",
            id:"bocaditos"
        },
        precio: 35.000
    },
    //confiteria
    {
        id:"Confiteria_Alfajores",
        titulo:"Alfajores",
        imagen:"./img/Confiteria/Alfajores.jpg",
        categoria:{
            nombre:"Confiteria",
            id:"confiteria"
        },
        precio:25.000
    },
    {
        id:"Confiteria_Croisant",
        titulo:"Coisant",
        imagen:"./img/Confiteria/Croisant.jpg",
        categoria:{
            nombre:"Confiteria",
            id:"confiteria"
        },
        precio:30.0000
    },
    {
        id:"Confiteria_Dulces",
        titulo:"Dulces",
        imagen:"./img/Confiteria/Dulces.jpg",
        categoria:{
            nombre:"Confiteria",
            id:"confiteria"
        },
        precio:25.000
    },
    {
        id:"Confiteria_Flanes",
        titulo:"Flan",
        imagen:"./img/Confiteria/Flanes.jpg",
        categoria:{
            nombre:"Confiteria",
            id:"confiteria"
        },
        precio: 20.000
    },
    {
        id:"Confiteria_Pais",
        titulo:"Pais de Manzana",
        imagen:"./img/Confiteria/Pais.jpg",
        categoria:{
            nombre:"Confiteria",
            id:"confiteria"
        },
        precio:35.000
    },
    {
        id:"Confiteria_PastaFloras",
        titulo:"Pasta Floras",
        imagen:"./img/Confiteria/PastaFloras.jpg",
        categoria:{
            nombre:"Confiteria",
            id:"confiteria"
        },
        precio:20.000
    },
    {
        id:"Confiteria_Tortas",
        titulo:"Torta",
        imagen:"./img/Confiteria/Tortas.jpg",
        categoria:{
            nombre:"Confiteria",
            id:"confiteria"
        },
        precio:45.000
    },
    //Panificados
    {
        id:"P_PanCaceroPremiun",
        titulo:"Pan Cacero de la casa",
        imagen:"./img/Panificados/PanCaceroPremiun.jpg",
        categoria:{
            nombre:"Panificados",
            id:"panificados"
        },
        precio: 20.000
    },
    {
        id:"P_PanChipp",
        titulo:"Pan Chip",
        imagen:"./img/Panificados/PanChipp.webp",
        categoria:{
            nombre:"Panificados",
            id:"panificados"
        },
        precio:15.000
    },
    {
        id:"P_Panes",
        titulo:"Pan Gallego",
        imagen:"./img/Panificados/Panes.jpg",
        categoria:{
            nombre:"Panificados",
            id:"panificados"
        },
        precio: 19.000
    },
    {
        id:"P_PanFelipe",
        titulo:"Pan Felipe",
        imagen:"./img/Panificados/PanFelipe.jpg",
        categoria:{
            nombre:"Panificados",
            id:"panificados"
        },
        precio:20.000
    },
    {
        id:"P_PanFuncional",
        titulo:"Pan Buguete",
        imagen:"./img/Panificados/PanFuncional.jpg",
        categoria:{
            nombre:"Panificados",
            id:"panificados"
        },
        precio:15.000
    },
    {
        id:"P_PaDelCampo",
        titulo:"Pan del Campo",
        imagen:"./img/Panificados/PanDelCampo.jpg",
        categoria:{
            nombre:"Panificados",
            id:"panificados"
        },
        precio:22.000
    },
    //Rosticeria
    {
        id:"ComboEmpanada_CocaCola",
        titulo:"Combo Empanada + Coca",
        imagen:"./img/Rostiseria/ComboEmpanada_CocaCola.jpg",
        categoria:{
            nombre:"Rosticeria",
            id:"rostisería"
        },
        precio:24.000
    },
    {
        id:"EmpanadaCarne",
        titulo:"Empanada de Carne",
        imagen:"./img/Rostiseria/EmpanadaCarne.jpg",
        categoria:{
            nombre:"Rosticeria",
            id:"rostisería"
        },
        precio:19.000
    },
    {
        id:"EmpanadaHuevo",
        titulo:"Empanada de Huevo",
        imagen:"./img/Rostiseria/EmpanadaHuevo.jpg",
        categoria:{
            nombre:"Rosticeria",
            id:"rostisería"
        },
        precio:17.000
    },
    {
        id:"EmpanadaJamonYQueso",
        titulo:"Empanada Jamon Y Queso",
        imagen:"./img/Rostiseria/EmpanadaJamonYQueso.jpg",
        categoria:{
            nombre:"Rosticeria",
            id:"rostisería"
        },
        precio:17.000
    },
    {
        id:"Mbeju",
        titulo:"Mbeju",
        imagen:"./img/Rostiseria/Mbeju.jpg",
        categoria:{
            nombre:"Rosticeria",
            id:"rostisería"
        },
        precio:14.000
    },
    {
        id:"ComboSandMilanesa_ConCoca",
        titulo:"Combo Sanwich de Milanesa",
        imagen:"./img/Rostiseria/ComboSandMilanesa_ConCoca.jpg",
        categoria:{
            nombre:"Rosticeria",
            id:"rostisería"
        },
        precio:25.000
    },
    {
        id:"EmpanadaMandioca",
        titulo:"Empanada de Mandioca",
        imagen:"./img/Rostiseria/EmpanadaMandioca.jpg",
        categoria:{
            nombre:"Rosticeria",
            id:"rostisería"
        },
        precio:10.000
    },
    {
        id:"EmpanadaSalteña_ConGaseosa",
        titulo:"Combo Empanada Salteña",
        imagen:"./img/Rostiseria/EmpanadaSalteña_ConGaseosa.jpg",
        categoria:{
            nombre:"Rosticeria",
            id:"rostisería"
        },
        precio:"26.000"
    }
];


const contenedorProductos = document.querySelector("#contenedor-productos");
const botonesCategorias = document.querySelectorAll(".boton-categoria");
const tituloPrincipal = document.querySelector("#titulo-principal");
let botonesAgregar = document.querySelectorAll(".producto-agregar");  //let ya que vamos a modificarlos
const numerito = document.querySelector("#numerito");

    function cargarProductos(productosElegidos){

        contenedorProductos.innerHTML = "";

        productosElegidos.forEach(producto =>{
            const div = document.createElement("div");
            div.classList.add("producto");
            div.innerHTML=`
                                <img class="producto-imagen" src="${producto.imagen}" alt=${producto.titulo} />
                                <div class="producto-detalles">
                                <h3 class="producto-titulo">${producto.titulo}</h3>
                                <p class="producto-precio">${producto.precio} Gs.</p>
                                <button class="producto-agregar" id="${producto.id}">Agregar</button>
            </div>
                `;

                contenedorProductos.append(div);
        })
        actualizarBotonesAgregar(); //para que se actualicen nuestros botones agregar cada vez que actualicemos nuestras vistas, ya sean "Todos los productos" ó "Bocaditos", etc.
    }
cargarProductos(productos);

    botonesCategorias.forEach(boton => {
        boton.addEventListener("click", (e) => {
            botonesCategorias.forEach(boton => boton.classList.remove("active"));
            e.currentTarget.classList.add("active");

            //para la carga de acuerdo al menu
            if(e.currentTarget.id !== "todos"){
                //tambien debemos cambiar el titulo de arriba de los contenedores
                const productoCategoria = productos.find(producto => producto.categoria.id === e.currentTarget.id);
                tituloPrincipal.innerHTML=productoCategoria.categoria.nombre;
                const productosBoton = productos.filter(producto => producto.categoria.id === e.currentTarget.id); 
                cargarProductos(productosBoton);

            }else{
        //en esta seccion en caso de necesitemos ver el apartado "todos los productos se carga el array completo"
                tituloPrincipal.innerHTML="Todos los productos";
                cargarProductos(productos);
            }  
        })
    });


    function actualizarBotonesAgregar(){
        botonesAgregar = document.querySelectorAll(".producto-agregar"); 

        botonesAgregar.forEach(boton =>{
            boton.addEventListener("click", agregarAlCarrito);
        });
        
    }
let productosEnCarrito;



let productosEnCarritoLS = localStorage.getItem("productos-en-carrito");

if (productosEnCarritoLS) {   // si traemos algo del localstorage y no es null, lo parseamos
    productosEnCarrito = JSON.parse(productosEnCarritoLS);
    actualizarNumerito();
} else {
    productosEnCarrito = [];
}

    function agregarAlCarrito(e){               // nos servira para agregar al array de nuestro carrito
        const idBoton= e.currentTarget.id;
        const productoAgregado = productos.find(producto => producto.id === idBoton );

        if(productosEnCarrito.some(producto => producto.id === idBoton)){
            // en caso de que ya exista el producto en carrito aumentarle la cantidad 
            const index = productosEnCarrito.findIndex(producto => producto.id === idBoton);
            productosEnCarrito[index].cantidad++;  
        } else {
            //en caso de que no exista el producto en carrito se agrega con cantidad = 1
            productoAgregado.cantidad = 1;  
            productosEnCarrito.push(productoAgregado);
        }
        actualizarNumerito();
        localStorage.setItem("productos-en-carrito", JSON.stringify(productosEnCarrito));
    }
                //para actualizar el numerito del carrito
    function actualizarNumerito(){
        let nuevoNumerito = productosEnCarrito.reduce((acc, producto) => acc+producto.cantidad, 0);
        numerito.innerHTML=nuevoNumerito;
    }

