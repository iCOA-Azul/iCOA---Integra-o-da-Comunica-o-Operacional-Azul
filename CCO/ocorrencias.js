
import { db, auth } from "../firebase.js";

import {
    collection,
    doc,
    onSnapshot,
    updateDoc
} from "firebase/firestore";

import { onAuthStateChanged } from "firebase/auth";

// ======================================
// ELEMENTOS DO HTML
// ======================================

const listaOcorrencias = document.getElementById("listaOcorrencias");
const semOcorrencias = document.getElementById("semOcorrencias");
const mensagemCarregamento = document.getElementById("mensagemCarregamento");

const contadorAtivas = document.getElementById("contadorAtivas");
const contadorAlta = document.getElementById("contadorAlta");
const contadorSetores = document.getElementById("contadorSetores");

const pesquisa = document.getElementById("pesquisa");
const filtroStatus = document.getElementById("filtroStatus");
const filtroGravidade = document.getElementById("filtroGravidade");

let todasOcorrencias = [];
let pararDeEscutarOcorrencias = null;

// ======================================
// FUNÇÕES AUXILIARES
// ======================================

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

function obterAreas(ocorrencia) {
    return Array.isArray(ocorrencia.areas)
        ? ocorrencia.areas
        : [];
}

function foiEncaminhadaAoCCO(ocorrencia) {
    return ocorrencia.setor === "CCO" ||
        obterAreas(ocorrencia).includes("CCO");
}

// ======================================
// CONTADORES
// ======================================

function atualizarContadores(ocorrencias) {
    const ativas = ocorrencias.filter(
        (ocorrencia) => ocorrencia.status !== "Encerrada"
    );

    contadorAtivas.textContent = ativas.length;

    contadorAlta.textContent = ativas.filter(
        (ocorrencia) => ocorrencia.gravidade === "Alta"
    ).length;

    const setores = new Set();

    ativas.forEach((ocorrencia) => {
        if (ocorrencia.setor) {
            setores.add(ocorrencia.setor);
        }

        obterAreas(ocorrencia).forEach((area) => {
            if (area) {
                setores.add(area);
            }
        });
    });

    contadorSetores.textContent = setores.size;
}

// ======================================
// PESQUISA E FILTROS
// ======================================

function aplicarFiltros() {
    const termo = pesquisa.value.trim().toLowerCase();
    const statusEscolhido = filtroStatus.value;
    const gravidadeEscolhida = filtroGravidade.value;

    const filtradas = todasOcorrencias.filter((ocorrencia) => {
        const encerrada = ocorrencia.status === "Encerrada";

        const textoPesquisa = [
            ocorrencia.voo,
            ocorrencia.aeronave,
            ocorrencia.tipo,
            ocorrencia.descricao,
            ocorrencia.setor,
            ocorrencia.status,
            ...obterAreas(ocorrencia)
        ].join(" ").toLowerCase();

        const correspondePesquisa = textoPesquisa.includes(termo);

        const correspondeStatus =
            statusEscolhido === "Todas" ||
            (statusEscolhido === "Ativas" && !encerrada) ||
            (statusEscolhido === "Encerrada" && encerrada);

        const correspondeGravidade =
            gravidadeEscolhida === "Todas" ||
            ocorrencia.gravidade === gravidadeEscolhida;

        return correspondePesquisa &&
            correspondeStatus &&
            correspondeGravidade;
    });

    listaOcorrencias.innerHTML = "";

    semOcorrencias.hidden = filtradas.length > 0;

    if (filtradas.length === 0) {
        semOcorrencias.querySelector("h4").textContent =
            todasOcorrencias.length === 0
                ? "Nenhuma ocorrência encontrada"
                : "Nenhuma ocorrência corresponde à pesquisa";

        semOcorrencias.querySelector("p").textContent =
            todasOcorrencias.length === 0
                ? "Quando uma ocorrência for encaminhada ao CCO, ela aparecerá aqui."
                : "Tente alterar o texto pesquisado ou os filtros selecionados.";

        return;
    }

    filtradas.forEach(criarCard);
}

// Atualiza a lista ao digitar ou mudar um filtro.
pesquisa.addEventListener("input", aplicarFiltros);
filtroStatus.addEventListener("change", aplicarFiltros);
filtroGravidade.addEventListener("change", aplicarFiltros);

// ======================================
// CRIAR CARTÃO
// ======================================

function criarCard(ocorrencia) {
    const encerrada = ocorrencia.status === "Encerrada";

    let corStatus = "amarelo";
    let textoGravidade = "MÉDIA";

    if (ocorrencia.gravidade === "Alta") {
        corStatus = "vermelho";
        textoGravidade = "ALTA";
    } else if (ocorrencia.gravidade === "Baixa") {
        corStatus = "verde";
        textoGravidade = "BAIXA";
    }

    const areas = obterAreas(ocorrencia);

    const card = document.createElement("div");
    card.classList.add("ocorrencia");

    card.innerHTML = `
        <div class="status-ocorrencia ${corStatus}"></div>

        <div class="informacoes-ocorrencia">
            <div class="linha-superior">
                <strong>${escaparHTML(
                    ocorrencia.voo || "Voo não informado"
                )}</strong>

                <span class="status texto-${corStatus}">
                    ${textoGravidade}
                </span>
            </div>

            <h4>${escaparHTML(
                ocorrencia.tipo || "Ocorrência operacional"
            )}</h4>

            <p>${escaparHTML(
                ocorrencia.descricao || "Sem descrição"
            )}</p>

            <div class="detalhes">
                <span>✈ ${escaparHTML(
                    ocorrencia.aeronave || "Não informada"
                )}</span>

                <span>🔧 Setor: ${escaparHTML(
                    ocorrencia.setor || "Não informado"
                )}</span>

                <span>● ${escaparHTML(
                    ocorrencia.status || "Em andamento"
                )}</span>

                <span>Áreas: ${escaparHTML(
                    areas.join(", ") || "Não informadas"
                )}</span>
            </div>
        </div>

        <div class="acoes-ocorrencia">
            <button class="botao-ver" type="button">
                Ver detalhes
            </button>

            ${encerrada ? "" : `
                <button class="botao-encerrar" type="button">
                    Encerrar
                </button>
            `}
        </div>
    `;

    listaOcorrencias.appendChild(card);

    // ======================================
    // VER DETALHES
    // ======================================

    card.querySelector(".botao-ver").addEventListener("click", function () {
        alert(
            "DETALHES DA OCORRÊNCIA\n\n" +
            "Voo: " + (ocorrencia.voo || "Não informado") +
            "\nAeronave: " + (ocorrencia.aeronave || "Não informada") +
            "\nTipo: " + (ocorrencia.tipo || "Não informado") +
            "\nGravidade: " + (ocorrencia.gravidade || "Não informada") +
            "\nDescrição: " + (ocorrencia.descricao || "Sem descrição") +
            "\nSetor responsável: " + (ocorrencia.setor || "Não informado") +
            "\nÁreas envolvidas: " + (areas.join(", ") || "Não informadas") +
            "\nStatus: " + (ocorrencia.status || "Em andamento")
        );
    });

    // Ocorrências encerradas não podem ser encerradas novamente.
    if (encerrada) {
        return;
    }

    // ======================================
    // ENCERRAR OCORRÊNCIA
    // ======================================

    card.querySelector(".botao-encerrar").addEventListener(
        "click",
        async function () {
            if (!confirm("Deseja encerrar esta ocorrência?")) {
                return;
            }

            try {
                await updateDoc(
                    doc(db, "ocorrencias", ocorrencia.id),
                    {
                        status: "Encerrada"
                    }
                );

                alert("Ocorrência encerrada com sucesso!");

                // A lista e os contadores serão atualizados pelo Firebase.
            } catch (erro) {
                console.error("Erro ao encerrar ocorrência:", erro);

                alert(
                    "Não foi possível encerrar a ocorrência. " +
                    "Verifique as permissões do Firestore."
                );
            }
        }
    );
}

// ======================================
// AUTENTICAÇÃO E FIREBASE EM TEMPO REAL
// ======================================

onAuthStateChanged(auth, function (usuario) {
    if (pararDeEscutarOcorrencias) {
        pararDeEscutarOcorrencias();
        pararDeEscutarOcorrencias = null;
    }

    if (!usuario) {
        window.location.href = "../index.html";
        return;
    }

    mensagemCarregamento.hidden = false;
    mensagemCarregamento.textContent = "Carregando ocorrências...";

    semOcorrencias.hidden = true;

    pararDeEscutarOcorrencias = onSnapshot(
        collection(db, "ocorrencias"),

        function (resultado) {
            // Mantém somente as ocorrências encaminhadas ao CCO.
            todasOcorrencias = resultado.docs
                .map((documento) => ({
                    id: documento.id,
                    ...documento.data()
                }))
                .filter(foiEncaminhadaAoCCO);

            mensagemCarregamento.hidden = true;

            atualizarContadores(todasOcorrencias);
            aplicarFiltros();
        },

        function (erro) {
            console.error("Erro ao carregar ocorrências:", erro);

            mensagemCarregamento.hidden = false;
            mensagemCarregamento.textContent =
                "Não foi possível carregar as ocorrências. Verifique sua conexão e as permissões do Firestore.";
        }
    );
});
