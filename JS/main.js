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
            id:"Confiteria"
        },
        precio:25.000
    },
    {
        id:"Confiteria_Croisant",
        titulo:"Coisant",
        imagen:"./img/Confiteria/Croisant.jpg",
        categoria:{
            nombre:"Confiteria",
            id:"Confiteria"
        },
        precio:30.0000
    },
    {
        id:"Confiteria_Dulces",
        titulo:"Dulces",
        imagen:"./img/Confiteria/Dulces.jpg",
        categoria:{
            nombre:"Confiteria",
            id:"Confiteria"
        },
        precio:25.000
    },
    {
        id:"Confiteria_Flanes",
        titulo:"Flan",
        imagen:"./img/Confiteria/Flanes.jpg",
        categoria:{
            nombre:"Confiteria",
            id:"Confiteria"
        },
        precio: 20.000
    },
    {
        id:"Confiteria_Pais",
        titulo:"Pais de Manzana",
        imagen:"./img/Confiteria/Pais.jpg",
        categoria:{
            nombre:"Confiteria",
            id:"Confiteria"
        },
        precio:35.000
    },
    {
        id:"Confiteria_PastaFloras",
        titulo:"Pasta Floras",
        imagen:"./img/Confiteria/PastaFloras.jpg",
        categoria:{
            nombre:"Confiteria",
            id:"Confiteria"
        },
        precio:20.000
    },
    {
        id:"Confiteria_Tortas",
        titulo:"Torta",
        imagen:"./img/Confiteria/Tortas.jpg",
        categoria:{
            nombre:"Confiteria",
            id:"Confiteria"
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
            id:"Panificados"
        },
        precio: 20.000
    },
    {
        id:"P_PanChipp",
        titulo:"Pan Chip",
        imagen:"./img/Panificados/PanChipp.webp",
        categoria:{
            nombre:"Panificados",
            id:"Panificados"
        },
        precio:15.000
    },
    {
        id:"P_Panes",
        titulo:"Pan Gallego",
        imagen:"./img/Panificados/Panes.jpg",
        categoria:{
            nombre:"Panificados",
            id:"Panificados"
        },
        precio: 19.000
    },
    {
        id:"P_PanFelipe",
        titulo:"Pan Felipe",
        imagen:"./img/Panificados/PanFelipe.jpg",
        categoria:{
            nombre:"Panificados",
            id:"Panificados"
        },
        precio:20.000
    },
    {
        id:"P_PanFuncional",
        titulo:"Pan Buguete",
        imagen:"./img/Panificados/PanFuncional.jpg",
        categoria:{
            nombre:"Panificados",
            id:"Panificados"
        },
        precio:15.000
    },
    {
        id:"P_PaDelCampo",
        titulo:"Pan del Campo",
        imagen:"./img/Panificados/PanDelCampo.jpg",
        categoria:{
            nombre:"Panificados",
            id:"Panificados"
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
            id:"Rosticeria"
        },
        precio:24.000
    },
    {
        id:"EmpanadaCarne",
        titulo:"Empanada de Carne",
        imagen:"./img/Rostiseria/EmpanadaCarne.jpg",
        categoria:{
            nombre:"Rosticeria",
            id:"Rosticeria"
        },
        precio:19.000
    },
    {
        id:"EmpanadaHuevo",
        titulo:"Empanada de Huevo",
        imagen:"./img/Rostiseria/EmpanadaHuevo.jpg",
        categoria:{
            nombre:"Rosticeria",
            id:"Rosticeria"
        },
        precio:17.000
    },
    {
        id:"EmpanadaJamonYQueso",
        titulo:"Empanada Jamon Y Queso",
        imagen:"./img/Rostiseria/EmpanadaJamonYQueso.jpg",
        categoria:{
            nombre:"Rosticeria",
            id:"Rosticeria"
        },
        precio:17.000
    },
    {
        id:"Mbeju",
        titulo:"Mbeju",
        imagen:"./img/Rostiseria/Mbeju.jpg",
        categoria:{
            nombre:"Rosticeria",
            id:"Rosticeria"
        },
        precio:14.000
    },
    {
        id:"ComboSandMilanesa_ConCoca",
        titulo:"Combo Sanwich de Milanesa",
        imagen:"./img/Rostiseria/ComboSandMilanesa_ConCoca.jpg",
        categoria:{
            nombre:"Rosticeria",
            id:"Rosticeria"
        },
        precio:25.000
    },
    {
        id:"EmpanadaMandioca",
        titulo:"Empanada de Mandioca",
        imagen:"./img/Rostiseria/EmpanadaMandioca.jpg",
        categoria:{
            nombre:"Rosticeria",
            id:"Rosticeria"
        },
        precio:10.000
    },
    {
        id:"EmpanadaSalteña_ConGaseosa",
        titulo:"Combo Empanada Salteña",
        imagen:"./img/Rostiseria/EmpanadaSalteña_ConGaseosa.jpg",
        categoria:{
            nombre:"Rosticeria",
            id:"Rosticeria"
        },
        precio:"26.000"
    }
]
const contenedorProductos= document.querySelector("#contenedor-productos");
const botonesCategoria= document.querySelectorAll(".boton-categoria");

function cargarProductos(productosElegidos ){

    contenedorProductos.innerHTML="";

    productosElegidos.forEach(producto =>{
        
        const div = document.createElement("div");
        div.classList.add("producto");
        div.innerHTML=`
         <img class="producto-imagen" src="${producto.imagen}" alt=${producto.titulo} />
          <div class="producto-detalles">
            <h3 class="producto-titulo">${producto.titulo}</h3>
            <p class="producto-precio">${producto.precio} Gs</p>
            <button class="producto-agregar" id="${producto.id}">Agregar</button>
        `
        contenedorProductos.append(div);
    })
    actualizarBotonesAgregar();

}
    cargarProductos(productos);

botonesCategoria.forEach(boton => {
    boton.addEventListener("click",(e)=>{
        botonesCategoria.forEach(boton => boton.classList.remove("active"));
        e.currentTarget.classList.add("active");
        if(e.currentTarget.id != "todos"){
            const productoCategoria = productos.find(producto => producto.categoria.id === e.currentTarget.id);
            tituloPrincipal.innerText = productoCategoria.categoria.nombre;
            const productosBoton = productos.filter(producto => producto.categoria.id === e.currentTarget.id);
            cargarProductos(productosBoton);
        } else {
            tituloPrincipal.innerText = "Todos los productos";
            cargarProductos(productos);
        }
    })
})

function actualizarBotonesAgregar() {
    botonesAgregar = document.querySelectorAll(".producto-agregar");

    botonesAgregar.forEach(boton => {
        boton.addEventListener("click", agregarAlCarrito);
    });
}