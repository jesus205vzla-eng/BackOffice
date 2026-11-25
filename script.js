const API_BASE = "https://portfolio-api-three-black.vercel.app/api/v1";

// Elementos de las páginas
const mensaje = document.getElementById("mensaje");
const formularioLogin = document.getElementById("formulario-login");
const formularioRegistro = document.getElementById("formulario-registro");
const formProyecto = document.getElementById("form-proyecto");

/* --- Funciones compartidas (token y usuario) --- */

function obtenerToken() {
  return localStorage.getItem("authToken");
}

function obtenerUsuario() {
  try {
    return JSON.parse(localStorage.getItem("usuario")) || {};
  } catch (error) {
    return {};
  }
}

function cerrarSesion() {
  localStorage.removeItem("authToken");
  localStorage.removeItem("usuario");
  window.location.replace("login.html");
}

// Pide a la api los datos y los devuelve
// Si ocurre un error lanza el Error con el mensaje y el código en error.estado
async function peticion(ruta, opciones = {}) {
  const headers = { "Content-Type": "application/json" };
  if (obtenerToken()) headers["auth-token"] = obtenerToken();

  const respuesta = await fetch(API_BASE + ruta, { ...opciones, headers }).catch(() => {
    throw new Error("No se pudo conectar con el servidor. Revisa tu internet.");
  });

  // La respuesta puede ser JSON, texto o venir vacía 
  const texto = await respuesta.text();
  let datos = null;
  try {
    datos = JSON.parse(texto);
  } catch (error) {
    datos = texto;
  }

  if (!respuesta.ok) {
    let mensajeError = "Ocurrió un error (código " + respuesta.status + ").";
    if (typeof datos === "string" && datos) {
      mensajeError = datos;
    } else if (datos && (datos.message || datos.error)) {
      mensajeError = datos.message || datos.error;
    }
    const falla = new Error(mensajeError);
    falla.estado = respuesta.status;
    throw falla;
  }
  return datos;
}

// manda mensaje de tipo: "ok" o "error"
function mostrarMensaje(elemento, texto, tipo) {
  elemento.textContent = texto;
  elemento.className = "mensaje mensaje--" + tipo;
  elemento.hidden = false;
}

/* --- Login ---*/

if (formularioLogin) {
  // Si hay una secion activa te lleva directo al home
  if (obtenerToken()) window.location.replace("home.html");

  formularioLogin.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mensaje.hidden = true;

    const correo = document.getElementById("email").value.trim();
    const contrasena = document.getElementById("password").value;
    const boton = document.getElementById("btn-entrar");
    boton.disabled = true;

    try {
      const datos = await peticion("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: correo, password: contrasena }),
      });
      if (!datos || !datos.token) throw new Error("El servidor no devolvió un token.");

      localStorage.setItem("authToken", datos.token);
      localStorage.setItem("usuario", JSON.stringify(datos.user || { email: correo }));
      window.location.replace("home.html");
    } catch (error) {
      // La API responde 400 o 401 cuando el correo o la contraseña no sirven
      const datosMalos = error.estado === 400 || error.estado === 401;
      mostrarMensaje(mensaje, datosMalos ? "Error: correo inválido o contraseña incorrecta." : error.message, "error");
      boton.disabled = false;
    }
  });
}

/* --- Registro ---*/

if (formularioRegistro) {
  // Si hay una secion activa te lleva directo al home 
 
  if (obtenerToken()) window.location.replace("home.html");

  formularioRegistro.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mensaje.hidden = true;

    const usuario = {
      name: document.getElementById("name").value.trim(),
      email: document.getElementById("email").value.trim(),
      itsonId: document.getElementById("itsonId").value.trim(),
      password: document.getElementById("password").value,
    };
    const boton = document.getElementById("btn-crear");
    boton.disabled = true;

    try {
      await peticion("/auth/register", { method: "POST", body: JSON.stringify(usuario) });
      mostrarMensaje(mensaje, "Cuenta creada. Te llevamos al inicio de sesión...", "ok");
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1500);
    } catch (error) {
      mostrarMensaje(mensaje, error.message, "error");
      boton.disabled = false;
    }
  });
}

/* ---CRUD de proyectos--- */

const lista = document.getElementById("lista-proyectos");
const sinProyectos = document.getElementById("sin-proyectos");
const plantilla = document.getElementById("plantilla-proyecto");
const formulario = document.getElementById("formulario");
const tituloFormulario = document.getElementById("titulo-formulario");
const mensajeFormulario = document.getElementById("mensaje-formulario");

let proyectos = [];
let idEditando = null; 

// "React, Node" -> ["React", "Node"]
function textoALista(texto) {
  const lista = [];

  texto.split(",").forEach(function (parte) {
    if (parte.trim() !== "") {
      lista.push(parte.trim());
    }
  });
  return lista;
}

// Solo se acepta direcciones http o https
function esUrl(texto) {
  return /^https?:\/\//i.test(texto);
}

async function iniciarHome() {
  // No se entra sin el token 
  if (!obtenerToken()) {
    cerrarSesion();
    return;
  }

  const usuario = obtenerUsuario();
  document.getElementById("nombre-usuario").textContent = usuario.name || usuario.email || "";

  document.getElementById("cerrar-sesion").addEventListener("click", cerrarSesion);
  document.getElementById("btn-agregar").addEventListener("click", () => mostrarFormulario(null));
  document.getElementById("btn-cancelar").addEventListener("click", () => {
    formulario.hidden = true;
  });
  formProyecto.addEventListener("submit", guardarProyecto);

  // Confirma ala api que el token sea valido al momento de pedir el proyecto
  try {
    await cargarProyectos();
  } catch (error) {
    if ([400, 401, 403].includes(error.estado)) {
      cerrarSesion();
      return;
    }
    mostrarMensaje(mensaje, error.message, "error");
  }
  document.body.hidden = false;
}

/* ---------- Leer (Read) ---------- */

async function cargarProyectos() {
  const datos = await peticion("/projects");
  proyectos = Array.isArray(datos) ? datos : (datos && datos.projects) || [];

  lista.replaceChildren();
  sinProyectos.hidden = proyectos.length > 0;
  proyectos.forEach((proyecto) => lista.appendChild(crearTarjeta(proyecto)));
  document.getElementById("total-proyectos").textContent = proyectos.length;
}

// Llena la plantilla con los datos del proyecto
function crearTarjeta(proyecto) {
  const tarjeta = plantilla.content.cloneNode(true);

  tarjeta.querySelector(".proyecto__titulo").textContent = proyecto.title;
  tarjeta.querySelector(".proyecto__descripcion").textContent = proyecto.description;

  const etiquetas = tarjeta.querySelector(".etiquetas");
  (proyecto.technologies || []).forEach((tecnologia) => {
    const item = document.createElement("li");
    item.textContent = tecnologia;
    etiquetas.appendChild(item);
  });

  let primeraImagen = null;
  (proyecto.images || []).forEach((imagen) => {
    if (!primeraImagen && esUrl(imagen)) {
      primeraImagen = imagen;
    }
  });
  if (primeraImagen) {
    const imagen = tarjeta.querySelector(".proyecto__imagen");
    imagen.src = primeraImagen;
    imagen.alt = "Imagen de " + proyecto.title;
    imagen.hidden = false;
  }

  if (esUrl(proyecto.repository || "")) {
    const enlace = tarjeta.querySelector(".proyecto__repo");
    enlace.href = proyecto.repository;
    enlace.hidden = false;
  }

  const id = proyecto._id || proyecto.id;
  tarjeta.querySelector(".btn-editar").addEventListener("click", () => editarProyecto(proyecto));
  tarjeta.querySelector(".btn-eliminar").addEventListener("click", () => borrarProyecto(id, proyecto.title));
  return tarjeta;
}

/* -- Leer un proyecto (GET /projects/:id) --*/

// Pide a la api el proyecto por su id y llena el formulario con sus datos actuales
async function editarProyecto(proyecto) {
  const id = proyecto._id || proyecto.id;
  mensaje.hidden = true;

  try {
    const datos = await peticion("/projects/" + id);
    // Si la respuesta no trae el proyecto, se usa el de la lista
    mostrarFormulario(datos && datos.title ? datos : proyecto);
  } catch (error) {
    mostrarFormulario(proyecto);
  }
}

/* -- Crear y Actualizar --*/


function mostrarFormulario(proyecto) {
  mensajeFormulario.hidden = true;
  formProyecto.reset();

  if (proyecto) {
    idEditando = proyecto._id || proyecto.id;
    tituloFormulario.textContent = "Actualizar proyecto";
    document.getElementById("titulo").value = proyecto.title || "";
    document.getElementById("descripcion").value = proyecto.description || "";
    document.getElementById("tecnologias").value = (proyecto.technologies || []).join(", ");
    document.getElementById("repositorio").value = proyecto.repository || "";
    document.getElementById("imagenes").value = (proyecto.images || []).join(", ");
  } else {
    idEditando = null;
    tituloFormulario.textContent = "Agregar proyecto";
  }

  formulario.hidden = false;
  formulario.scrollIntoView({ behavior: "smooth" });
  document.getElementById("titulo").focus();
}

async function guardarProyecto(evento) {
  evento.preventDefault();
  mensajeFormulario.hidden = true;

  // toma  el token del usuario en vez del ID 
  const datos = {
    title: document.getElementById("titulo").value.trim(),
    description: document.getElementById("descripcion").value.trim(),
    technologies: textoALista(document.getElementById("tecnologias").value),
    images: textoALista(document.getElementById("imagenes").value),
  };
  const repositorio = document.getElementById("repositorio").value.trim();
  if (repositorio) datos.repository = repositorio;

  const boton = document.getElementById("btn-guardar");
  boton.disabled = true;

  try {
    // Con el id se actualiza ; sin el id se crea 
    await peticion(idEditando ? "/projects/" + idEditando : "/projects", {
      method: idEditando ? "PUT" : "POST",
      body: JSON.stringify(datos),
    });
    formulario.hidden = true;
    await cargarProyectos();
    mostrarMensaje(mensaje, idEditando ? "Proyecto actualizado." : "Proyecto creado.", "ok");
  } catch (error) {
    mostrarMensaje(mensajeFormulario, error.message, "error");
  }
  boton.disabled = false;
}

/* --- Eliminar --- */

async function borrarProyecto(id, titulo) {
  if (!confirm("¿Eliminar el proyecto \"" + titulo + "\"?")) return;
  mensaje.hidden = true;

  try {
    await peticion("/projects/" + id, { method: "DELETE" });
    await cargarProyectos();
    mostrarMensaje(mensaje, "Proyecto eliminado.", "ok");
  } catch (error) {
    mostrarMensaje(mensaje, error.message, "error");
  }
}

// Arranca el home 
if (formProyecto) iniciarHome();
