
import { db, auth } from "../firebase.js";

import {
    collection,
    addDoc,
    doc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp
} from "firebase/firestore";

import { onAuthStateChanged } from "firebase/auth";

const botaoNovaOcorrencia = document.getElementById("novaOcorrencia");
const formularioOcorrencia = document.getElementById("formularioOcorrencia");
const formOcorrencia = document.getElementById("formOcorrencia");
const botaoCancelar = document.getElementById("cancelarOcorrencia");

const listaOcorrencias = document.getElementById("listaOcorrencias");
const semOcorrencias = document.getElementById("semOcorrencias");
const contadorOcorrencias = document.getElementById("contadorOcorrencias");

const pesquisaOcorrencias = document.getElementById("pesquisaOcorrencias");
const filtroStatus = document.getElementById("filtroStatus");
const filtroGravidade = document.getElementById("filtroGravidade");
const mensagemCarregamento = document.getElementById("mensagemCarregamento");

const contadorComunicacoes = document.getElementById("contadorComunicacoes");

let usuarioAtual = null;
let todasOcorrencias = [];
let pararDeEscutar = null;
let pararDeEscutarComunicacoes = null;

function escaparHTML(valor = "") {
    return String(valor).replace(/[&<>"']/g, function (caractere) {
        const caracteres = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return caracteres[caractere];
    });
}

// Abrir formulário
botaoNovaOcorrencia.addEventListener("click", function () {
    formularioOcorrencia.style.display = "block";
    botaoNovaOcorrencia.style.display = "none";

    formularioOcorrencia.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
});

// Cancelar formulário
botaoCancelar.addEventListener("click", function () {
    formOcorrencia.reset();
    formularioOcorrencia.style.display = "none";
    botaoNovaOcorrencia.style.display = "block";
});

// Aplicar pesquisa e filtros
pesquisaOcorrencias.addEventListener("input", aplicarFiltros);
filtroStatus.addEventListener("change", aplicarFiltros);
filtroGravidade.addEventListener("change", aplicarFiltros);

function aplicarFiltros() {
    const textoPesquisa = pesquisaOcorrencias.value.trim().toLowerCase();
    const statusSelecionado = filtroStatus.value;
    const gravidadeSelecionada = filtroGravidade.value;

    const ocorrenciasFiltradas = todasOcorrencias.filter(function (ocorrencia) {
        const textoOcorrencia = [
            ocorrencia.voo,
            ocorrencia.aeronave,
            ocorrencia.tipo,
            ocorrencia.descricao,
            ocorrencia.setor,
            ...(ocorrencia.areas || [])
        ].join(" ").toLowerCase();

        const correspondeTexto = textoOcorrencia.includes(textoPesquisa);

        const statusAtual = ocorrencia.status || "Em andamento";

        let correspondeStatus = true;

        if (statusSelecionado === "Ativas") {
            correspondeStatus = statusAtual !== "Encerrada";
        } else if (statusSelecionado === "Encerrada") {
            correspondeStatus = statusAtual === "Encerrada";
        }

        const correspondeGravidade =
            gravidadeSelecionada === "Todas" ||
            ocorrencia.gravidade === gravidadeSelecionada;

        return correspondeTexto && correspondeStatus && correspondeGravidade;
    });

    mostrarLista(ocorrenciasFiltradas);
}

function mostrarLista(ocorrencias) {
    listaOcorrencias.querySelectorAll(".ocorrencia").forEach(function (card) {
        card.remove();
    });

    contadorOcorrencias.textContent = todasOcorrencias.filter(function (ocorrencia) {
        return (ocorrencia.status || "Em andamento") !== "Encerrada";
    }).length;

    semOcorrencias.style.display = ocorrencias.length === 0 ? "block" : "none";

    if (ocorrencias.length === 0) {
        semOcorrencias.textContent = todasOcorrencias.length === 0
            ? "Nenhuma ocorrência foi direcionada ao Handling."
            : "Nenhuma ocorrência corresponde à pesquisa ou aos filtros selecionados.";
    }

    ocorrencias.forEach(criarCard);
}

function criarCard(ocorrencia) {
    let corStatus = "amarelo";
    let textoGravidade = "MÉDIA";

    if (ocorrencia.gravidade === "Alta") {
        corStatus = "vermelho";
        textoGravidade = "ALTA";
    } else if (ocorrencia.gravidade === "Baixa") {
        corStatus = "verde";
        textoGravidade = "BAIXA";
    }

    const statusAtual = ocorrencia.status || "Em andamento";

    const card = document.createElement("div");
    card.classList.add("ocorrencia");

    card.innerHTML = `
        <div class="status-ocorrencia ${corStatus}"></div>

        <div class="informacoes-ocorrencia">
            <div class="linha-superior">
                <strong>${escaparHTML(ocorrencia.voo || "Voo não informado")}</strong>
                <span class="status texto-${corStatus}">
                    ${textoGravidade}
                </span>
            </div>

            <h4>${escaparHTML(ocorrencia.tipo || "Ocorrência operacional")}</h4>

            <p>${escaparHTML(ocorrencia.descricao || "Sem descrição")}</p>

            <div class="detalhes">
                <span>✈ ${escaparHTML(ocorrencia.aeronave || "Não informada")}</span>
                <span>🔧 ${escaparHTML(ocorrencia.setor || "Não informado")}</span>
                <span>● ${escaparHTML(statusAtual)}</span>
                <span>Áreas: ${escaparHTML((ocorrencia.areas || []).join(", "))}</span>
            </div>
        </div>

        <div class="acoes-ocorrencia">
            <button class="botao-ver" type="button">Ver detalhes</button>
            <button class="botao-encerrar" type="button">Encerrar ocorrência</button>
            <button class="botao-excluir" type="button">Excluir</button>
        </div>
    `;

    listaOcorrencias.appendChild(card);

    const botaoVer = card.querySelector(".botao-ver");

    botaoVer.addEventListener("click", function () {
        alert(
            "DETALHES DA OCORRÊNCIA\n\n" +
            "Voo: " + (ocorrencia.voo || "Não informado") + "\n" +
            "Aeronave: " + (ocorrencia.aeronave || "Não informada") + "\n" +
            "Tipo: " + (ocorrencia.tipo || "Não informado") + "\n" +
            "Gravidade: " + (ocorrencia.gravidade || "Não informada") + "\n" +
            "Descrição: " + (ocorrencia.descricao || "Sem descrição") + "\n" +
            "Setor responsável pelo registro: " + (ocorrencia.setor || "Não informado") + "\n" +
            "Áreas: " + ((ocorrencia.areas || []).join(", ") || "Nenhuma informada") + "\n" +
            "Status: " + statusAtual
        );
    });

    const podeGerenciar = usuarioAtual &&
        (
            usuarioAtual.email === "cco@icoa.com" ||
            ocorrencia.criadoPorUid === usuarioAtual.uid
        );

    const botaoEncerrar = card.querySelector(".botao-encerrar");

    if (!podeGerenciar || statusAtual === "Encerrada") {
        botaoEncerrar.style.display = "none";
    }

    botaoEncerrar.addEventListener("click", async function () {
        if (!podeGerenciar) {
            alert("Você não tem permissão para encerrar esta ocorrência.");
            return;
        }

        if (!confirm("Deseja realmente encerrar esta ocorrência?")) {
            return;
        }

        botaoEncerrar.disabled = true;

        try {
            await updateDoc(doc(db, "ocorrencias", ocorrencia.id), {
                status: "Encerrada"
            });

            alert("Ocorrência encerrada com sucesso!");
        } catch (erro) {
            console.error("Erro ao encerrar ocorrência:", erro);
            alert("Não foi possível encerrar. Verifique as regras do Firestore.");
            botaoEncerrar.disabled = false;
        }
    });

    const botaoExcluir = card.querySelector(".botao-excluir");

    if (!podeGerenciar) {
        botaoExcluir.style.display = "none";
    }

    botaoExcluir.addEventListener("click", async function () {
        if (!podeGerenciar) {
            alert("Você não tem permissão para excluir esta ocorrência.");
            return;
        }

        if (!confirm("Deseja realmente excluir esta ocorrência?")) {
            return;
        }

        botaoExcluir.disabled = true;

        try {
            await deleteDoc(doc(db, "ocorrencias", ocorrencia.id));
            alert("Ocorrência excluída com sucesso!");
        } catch (erro) {
            console.error("Erro ao excluir ocorrência:", erro);
            alert("Não foi possível excluir. Verifique as regras do Firestore.");
            botaoExcluir.disabled = false;
        }
    });
}

// Registrar ocorrência
formOcorrencia.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!auth.currentUser) {
        alert("Sua sessão não está ativa. Entre novamente no sistema.");
        return;
    }

    const voo = document.getElementById("voo").value.trim();
    const aeronave = document.getElementById("aeronave").value.trim();
    const tipo = document.getElementById("tipo").value;
    const gravidade = document.getElementById("gravidade").value;
    const descricao = document.getElementById("descricao").value.trim();

    const areas = [];

    document.querySelectorAll('input[name="areas"]:checked').forEach(function (caixa) {
        areas.push(caixa.value);
    });

    if (areas.length === 0) {
        alert("Selecione pelo menos uma área que deverá receber a ocorrência.");
        return;
    }

    const novaOcorrencia = {
        voo,
        aeronave,
        tipo,
        gravidade,
        descricao,
        setor: "Handling",
        areas,
        status: "Em andamento",
        criadoPorUid: auth.currentUser.uid,
        criadoEm: serverTimestamp()
    };

    const botaoEnviar = formOcorrencia.querySelector('button[type="submit"]');
    botaoEnviar.disabled = true;

    try {
        await addDoc(collection(db, "ocorrencias"), novaOcorrencia);

        formOcorrencia.reset();
        formularioOcorrencia.style.display = "none";
        botaoNovaOcorrencia.style.display = "block";

        alert("Ocorrência registrada e enviada aos setores selecionados!");
    } catch (erro) {
        console.error("Erro ao registrar ocorrência:", erro);
        alert("Não foi possível registrar. Verifique as regras do Firestore.");
    } finally {
        botaoEnviar.disabled = false;
    }
});

// Carregar ocorrências do Firebase
onAuthStateChanged(auth, function (usuario) {
    if (!usuario) {
        window.location.href = "../index.html";
        return;
    }

    usuarioAtual = usuario;

    if (pararDeEscutar) {
        pararDeEscutar();
    }

    mensagemCarregamento.hidden = false;

    pararDeEscutar = onSnapshot(
        collection(db, "ocorrencias"),
        function (resultado) {
            const todasDoFirebase = resultado.docs.map(function (documento) {
                return {
                    id: documento.id,
                    ...documento.data()
                };
            });

            todasOcorrencias = todasDoFirebase.filter(function (ocorrencia) {
                return ocorrencia.setor === "Handling" ||
                    (ocorrencia.areas || []).includes("Handling");
            });

            mensagemCarregamento.hidden = true;
            aplicarFiltros();
        },
        function (erro) {
            mensagemCarregamento.hidden = true;
            console.error("Erro ao carregar ocorrências:", erro);
            alert("Não foi possível carregar as ocorrências. Confira as regras do Firestore.");
        }
    );

    // Contador de comunicações não lidas
    if (pararDeEscutarComunicacoes) {
        pararDeEscutarComunicacoes();
    }

    pararDeEscutarComunicacoes = onSnapshot(
        collection(db, "comunicacoes"),
        function (snapshot) {
            const quantidadeNaoLidas = snapshot.docs.filter(function (documento) {
                const mensagem = documento.data();

                return mensagem.destinatario === "Handling" &&
                    mensagem.lida !== true;
            }).length;

            if (contadorComunicacoes) {
                contadorComunicacoes.textContent = quantidadeNaoLidas;
            }
        },
        function (erro) {
            console.error("Erro ao atualizar o contador de comunicações:", erro);
        }
    );
});
