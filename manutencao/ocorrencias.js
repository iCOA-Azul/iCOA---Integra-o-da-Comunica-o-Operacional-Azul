
import { db, auth } from "../firebase.js";

import {
    collection,
    doc,
    onSnapshot,
    updateDoc,
    deleteDoc
} from "firebase/firestore";

import { onAuthStateChanged } from "firebase/auth";

const SETOR = "Manutenção";

const lista = document.getElementById("listaOcorrencias");
const carregando = document.getElementById("carregando");
const semOcorrencias = document.getElementById("semOcorrencias");
const erroOcorrencias = document.getElementById("erroOcorrencias");

const contadorTotal = document.getElementById("contadorTotal");
const contadorAtivas = document.getElementById("contadorAtivas");
const contadorAlta = document.getElementById("contadorAlta");

const pesquisa = document.getElementById("pesquisa");
const filtroStatus = document.getElementById("filtroStatus");
const filtroOrigem = document.getElementById("filtroOrigem");

let todasOcorrencias = [];
let pararDeEscutar = null;

function escaparHTML(valor = "") {
    return String(valor).replace(/[&<>"']/g, (caractere) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[caractere]);
}

function obterAreas(dados) {
    return Array.isArray(dados.areas) ? dados.areas : [];
}

function formatarHorario(timestamp) {
    if (!timestamp?.toDate) {
        return "Horário não disponível";
    }

    return timestamp.toDate().toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function envolveManutencao(dados) {
    return dados.setor === SETOR ||
        obterAreas(dados).includes(SETOR);
}

function foiRegistradaPeloUsuario(dados) {
    return Boolean(
        auth.currentUser &&
        dados.criadoPorUid &&
        dados.criadoPorUid === auth.currentUser.uid
    );
}

function atualizarContadores(ocorrencias) {
    contadorTotal.textContent = ocorrencias.length;

    contadorAtivas.textContent = ocorrencias.filter(
        (dados) => dados.status !== "Encerrada"
    ).length;

    contadorAlta.textContent = ocorrencias.filter(
        (dados) =>
            dados.status !== "Encerrada" &&
            dados.gravidade === "Alta"
    ).length;
}

function renderizar() {
    lista.innerHTML = "";

    const termo = pesquisa.value.trim().toLowerCase();
    const statusSelecionado = filtroStatus.value;
    const origemSelecionada = filtroOrigem.value;

    const filtradas = todasOcorrencias.filter((dados) => {
        const propria = foiRegistradaPeloUsuario(dados);
        const encerrada = dados.status === "Encerrada";

        const texto = [
            dados.voo,
            dados.aeronave,
            dados.tipo,
            dados.descricao,
            dados.setor,
            ...obterAreas(dados)
        ].join(" ").toLowerCase();

        const correspondePesquisa = texto.includes(termo);

        const correspondeStatus =
            statusSelecionado === "Todas" ||
            (statusSelecionado === "Ativas" && !encerrada) ||
            (statusSelecionado === "Encerrada" && encerrada);

        const correspondeOrigem =
            origemSelecionada === "Todas" ||
            (origemSelecionada === "Proprias" && propria) ||
            (origemSelecionada === "Acionada" && !propria);

        return correspondePesquisa &&
            correspondeStatus &&
            correspondeOrigem;
    });

    semOcorrencias.hidden = filtradas.length > 0;

    filtradas.forEach(criarCartao);
}

function criarCartao(dados) {
    const propria = foiRegistradaPeloUsuario(dados);
    const encerrada = dados.status === "Encerrada";
    const areas = obterAreas(dados);

    let cor = "amarelo";
    let gravidade = "MÉDIA";

    if (dados.gravidade === "Alta") {
        cor = "vermelho";
        gravidade = "ALTA";
    } else if (dados.gravidade === "Baixa") {
        cor = "verde";
        gravidade = "BAIXA";
    }

    const card = document.createElement("article");
    card.className = "ocorrencia";

    let botoes = "";

    if (propria && !encerrada) {
        botoes = `
            <button class="botao-encerrar" type="button">
                Encerrar ocorrência
            </button>
            <button class="botao-excluir" type="button">
                Excluir
            </button>
        `;
    } else {
        botoes = `
            <span class="permissao-ocorrencia">
                ${encerrada
                    ? "Ocorrência encerrada"
                    : propria
                        ? "Registrada por você"
                        : "Somente visualização"}
            </span>
        `;
    }

    card.innerHTML = `
        <div class="status-ocorrencia ${cor}"></div>

        <div class="informacoes-ocorrencia">
            <div class="linha-superior">
                <strong>${escaparHTML(dados.voo || "Voo não informado")}</strong>
                <span class="status texto-${cor}">${gravidade}</span>
            </div>

            <h4>${escaparHTML(dados.tipo || "Ocorrência operacional")}</h4>

            <p>${escaparHTML(dados.descricao || "Sem descrição")}</p>

            <div class="detalhes">
                <span>✈ Aeronave: ${escaparHTML(dados.aeronave || "Não informada")}</span>
                <span>🔧 Registrada por: ${escaparHTML(dados.setor || "Não informado")}</span>
                <span>● Status: ${escaparHTML(dados.status || "Em andamento")}</span>
                <span>Áreas acionadas: ${escaparHTML(areas.join(", ") || "Não informadas")}</span>
                <span>🕒 ${escaparHTML(formatarHorario(dados.criadoEm))}</span>
            </div>

            <div class="acoes-ocorrencia">
                <button class="botao-ver" type="button">Ver detalhes</button>
                ${botoes}
            </div>
        </div>
    `;

    lista.appendChild(card);

    card.querySelector(".botao-ver").addEventListener("click", () => {
        alert(
            "DETALHES DA OCORRÊNCIA\n\n" +
            "Voo: " + (dados.voo || "Não informado") +
            "\nAeronave: " + (dados.aeronave || "Não informada") +
            "\nTipo: " + (dados.tipo || "Não informado") +
            "\nGravidade: " + (dados.gravidade || "Não informada") +
            "\nDescrição: " + (dados.descricao || "Sem descrição") +
            "\nSetor que registrou: " + (dados.setor || "Não informado") +
            "\nÁreas acionadas: " + (areas.join(", ") || "Não informadas") +
            "\nStatus: " + (dados.status || "Em andamento") +
            "\nData: " + formatarHorario(dados.criadoEm)
        );
    });

    if (!propria || encerrada) {
        return;
    }

    card.querySelector(".botao-encerrar").addEventListener("click", async () => {
        if (!foiRegistradaPeloUsuario(dados)) {
            alert("Você só pode encerrar ocorrências que registrou.");
            return;
        }

        if (!confirm("Deseja encerrar esta ocorrência?")) {
            return;
        }

        try {
            await updateDoc(doc(db, "ocorrencias", dados.id), {
                status: "Encerrada"
            });

            alert("Ocorrência encerrada com sucesso!");
        } catch (erro) {
            console.error("Erro ao encerrar:", erro);
            alert("Não foi possível encerrar. Confira as regras do Firestore.");
        }
    });

    card.querySelector(".botao-excluir").addEventListener("click", async () => {
        if (!foiRegistradaPeloUsuario(dados)) {
            alert("Você só pode excluir ocorrências que registrou.");
            return;
        }

        if (!confirm("Deseja realmente excluir esta ocorrência?")) {
            return;
        }

        try {
            await deleteDoc(doc(db, "ocorrencias", dados.id));

            alert("Ocorrência excluída com sucesso!");
        } catch (erro) {
            console.error("Erro ao excluir:", erro);
            alert("Não foi possível excluir. Confira as regras do Firestore.");
        }
    });
}

pesquisa.addEventListener("input", renderizar);
filtroStatus.addEventListener("change", renderizar);
filtroOrigem.addEventListener("change", renderizar);

onAuthStateChanged(auth, (usuario) => {
    if (pararDeEscutar) {
        pararDeEscutar();
        pararDeEscutar = null;
    }

    if (!usuario) {
        window.location.href = "../index.html";
        return;
    }

    carregando.hidden = false;
    erroOcorrencias.hidden = true;
    semOcorrencias.hidden = true;

    pararDeEscutar = onSnapshot(
        collection(db, "ocorrencias"),
        (snapshot) => {
            carregando.hidden = true;

            todasOcorrencias = snapshot.docs
                .map((documento) => ({
                    id: documento.id,
                    ...documento.data()
                }))
                .filter(envolveManutencao);

            atualizarContadores(todasOcorrencias);
            renderizar();
        },
        (erro) => {
            console.error("Erro ao carregar ocorrências:", erro);

            carregando.hidden = true;
            erroOcorrencias.hidden = false;
        }
    );
});

console.log("iCOA — Ocorrências da Manutenção carregado.");
