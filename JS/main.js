const productos = [
  // bocaditos
  { id:"Bocaditos_Ct_01", titulo:"Bocaditos Combo 1", imagen:"https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/ServicioCathering1.jpg", categoria:{ nombre:"Bocaditos", id:"bocaditos" }, precio:55000 },
  { id:"Bocaditos_Ct_02", titulo:"Bocaditos Combo 2", imagen:"https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/ServicioCathering2.jpeg", categoria:{ nombre:"Bocaditos", id:"bocaditos" }, precio:50000 },
  { id:"Bocaditos_Ct_03", titulo:"Bocaditos Combo 3", imagen:"https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/ServicioCathering3.jpeg", categoria:{ nombre:"Bocaditos", id:"bocaditos" }, precio:150000 },
  { id:"Bocaditos_Ct_04", titulo:"Bocaditos Combo 4", imagen:"https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/ServicioCathering4.jpeg", categoria:{ nombre:"Bocaditos", id:"bocaditos" }, precio:75000 },
  { id:"Bocaditos_Ct_Pareja", titulo:"Bocadito en Pareja", imagen:"https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/ServicioCatheringPareja.jpg", categoria:{ nombre:"Bocaditos", id:"bocaditos" }, precio:65000 },
  { id:"Bocaditos_Ct_Personal", titulo:"Bocadito Personal", imagen:"https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/ServicioCatheringPersonal.jpg", categoria:{ nombre:"Bocaditos", id:"bocaditos" }, precio:35000 },

  // confiteria
  { id:"Confiteria_Alfajores", titulo:"Alfajores", imagen:"https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/Alfajores.jpg", categoria:{ nombre:"Confiteria", id:"confiteria" }, precio:25000 },
  { id:"Confiteria_Croisant", titulo:"Coisant", imagen:"https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/Croisant.jpg", categoria:{ nombre:"Confiteria", id:"confiteria" }, precio:30000 },
  { id:"Confiteria_Dulces", titulo:"Dulces", imagen:"https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/Dulces.jpg", categoria:{ nombre:"Confiteria", id:"confiteria" }, precio:25000 },
  { id:"Confiteria_Flanes", titulo:"Flan", imagen:"https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/Flanes.jpg", categoria:{ nombre:"Confiteria", id:"confiteria" }, precio:20000 },
  { id:"Confiteria_Pais", titulo:"Pais de Manzana", imagen:"https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/Pais.jpg", categoria:{ nombre:"Confiteria", id:"confiteria" }, precio:35000 },
  { id:"Confiteria_PastaFloras", titulo:"Pasta Floras", imagen:"https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/Pastafloras.jpg", categoria:{ nombre:"Confiteria", id:"confiteria" }, precio:20000 },
  { id:"Confiteria_Tortas", titulo:"Torta", imagen:"https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/Tortas.jpg", categoria:{ nombre:"Confiteria", id:"confiteria" }, precio:45000 },

  // panificados
  { id:"P_PanCaceroPremiun", titulo:"Pan Cacero de la casa", imagen:"https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/PanCaceroPremiun.jpg", categoria:{ nombre:"Panificados", id:"panificados" }, precio:20000 },
  { id:"P_PanChipp", titulo:"Pan Chip", imagen:"https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/PanChipp.webp", categoria:{ nombre:"Panificados", id:"panificados" }, precio:15000 },
  { id:"P_Panes", titulo:"Pan Gallego", imagen:"https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/Panes.jpg", categoria:{ nombre:"Panificados", id:"panificados" }, precio:19000 },
  { id:"P_PanFelipe", titulo:"Pan Felipe", imagen:"https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/PanFelipe.jpg", categoria:{ nombre:"Panificados", id:"panificados" }, precio:20000 },
  { id:"P_PanFuncional", titulo:"Pan Buguete", imagen:"https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/PanFuncional.jpg", categoria:{ nombre:"Panificados", id:"panificados" }, precio:15000 },
  { id:"P_PaDelCampo", titulo:"Pan del Campo", imagen:"https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/PanDelCampo.jpg", categoria:{ nombre:"Panificados", id:"panificados" }, precio:22000 },

  // rostiseria
  { id:"ComboEmpanada_CocaCola", titulo:"Combo Empanada + Coca", imagen:"/img/rostiseria/ComboEmpanada_CocaCola.jpg", categoria:{ nombre:"Rosticeria", id:"rostisería" }, precio:24000 },
  { id:"EmpanadaCarne", titulo:"Empanada de Carne", imagen:"https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/EmpanadaCarne.jpg", categoria:{ nombre:"Rosticeria", id:"rostisería" }, precio:19000 },
  { id:"EmpanadaHuevo", titulo:"Empanada de Huevo", imagen:"https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/EmpanadaHuevo.jpg", categoria:{ nombre:"Rosticeria", id:"rostisería" }, precio:17000 },
  { id:"EmpanadaJamonYQueso", titulo:"Empanada Jamon Y Queso", imagen:"https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/EmpanadaJamonYQueso.jpg", categoria:{ nombre:"Rosticeria", id:"rostisería" }, precio:17000 },
  { id:"Mbeju", titulo:"Mbeju", imagen:"https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/Mbeju.jpg", categoria:{ nombre:"Rosticeria", id:"rostisería" }, precio:14000 },
  { id:"ComboSandMilanesa_ConCoca", titulo:"Combo Sanwich de Milanesa", imagen:"https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/ComboSandMilanesa_ConCoca.jpg", categoria:{ nombre:"Rosticeria", id:"rostisería" }, precio:25000 },
  { id:"EmpanadaMandioca", titulo:"Empanada de Mandioca", imagen:"https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/EmpanadaMandioca.jpg", categoria:{ nombre:"Rosticeria", id:"rostisería" }, precio:10000 },
  { id:"EmpanadaSalteña_ConGaseosa", titulo:"Combo Empanada Salteña", imagen:"https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/ComboEmpanada_CocaCola.jpg", categoria:{ nombre:"Rosticeria", id:"rostisería" }, precio:26000 }
];



const contenedorProductos = document.querySelector("#contenedor-productos");
const botonesCategorias = document.querySelectorAll(".boton-categoria");
const tituloPrincipal = document.querySelector("#titulo-principal");
let botonesAgregar = document.querySelectorAll(".producto-agregar"); 
const numerito = document.querySelector("#numerito");

    function cargarProductos(productosElegidos){

        contenedorProductos.innerHTML = "";

        productosElegidos.forEach(producto =>{
            const div = document.createElement("div");
            div.classList.add("producto");
            div.innerHTML=`
                                <img class="producto-imagen" src="${producto.imagen}" alt="${producto.titulo}" />
                                <div class="producto-detalles">
                                <h3 class="producto-titulo">${producto.titulo}</h3>
                                <b><p class="producto-precio">${formatearGs(producto.precio)}</p></b>
                                <button class="producto-agregar" id="${producto.id}">Agregar</button>
            </div>
                `;

                contenedorProductos.append(div);
        })
        actualizarBotonesAgregar(); //para que se actualicen nuestros botones agregar cada vez que actualicemos nuestras vistas, ya sean "Todos los productos" ó "Bocaditos", etc.
    }



    function formatearGs(n) {
  return new Intl.NumberFormat('es-PY').format(Number(n)) + ' Gs';
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


    
  // Toggle visual del menú de usuario
  const userBtn = document.getElementById('userMenuBtn');
  const dropdown = document.getElementById('userDropdown');

  function closeMenu(e) {
    if (!dropdown.contains(e.target) && !userBtn.contains(e.target)) {
      dropdown.classList.remove('open');
      userBtn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('click', closeMenu);
    }
  }
  userBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
    userBtn.setAttribute('aria-expanded', dropdown.classList.contains('open') ? 'true' : 'false');
    if (dropdown.classList.contains('open')) {
      setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }
  });

  // (La lógica real de búsqueda y actualizar datos la vemos después)


