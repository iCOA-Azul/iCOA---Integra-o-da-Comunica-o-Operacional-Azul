
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

// ELEMENTOS DO HTML
const botaoNovaOcorrencia = document.getElementById("novaOcorrencia");
const formularioOcorrencia = document.getElementById("formularioOcorrencia");
const formOcorrencia = document.getElementById("formOcorrencia");
const botaoCancelar = document.getElementById("cancelarOcorrencia");
const listaOcorrencias = document.getElementById("listaOcorrencias");
const semOcorrencias = document.getElementById("semOcorrencias");
const contadorOcorrencias = document.getElementById("contadorOcorrencias");

let usuarioAtual = null;
let pararDeEscutar = null;

// PROTEGER TEXTOS EXIBIDOS NOS CARDS
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

// ABRIR FORMULÁRIO
botaoNovaOcorrencia.addEventListener("click", function () {
    formularioOcorrencia.style.display = "block";
    botaoNovaOcorrencia.style.display = "none";

    formularioOcorrencia.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
});

// CANCELAR CADASTRO
botaoCancelar.addEventListener("click", function () {
    formOcorrencia.reset();
    formularioOcorrencia.style.display = "none";
    botaoNovaOcorrencia.style.display = "block";
});

// CARREGAR E MOSTRAR OCORRÊNCIAS
function mostrarOcorrencias(documentos) {
    listaOcorrencias.querySelectorAll(".ocorrencia").forEach(function (card) {
        card.remove();
    });

    const todasOcorrencias = documentos.map(function (documento) {
        return {
            id: documento.id,
            ...documento.data()
        };
    });

    // MOSTRAR OCORRÊNCIAS DESTINADAS AO HANDLING
    const ocorrenciasHandling = todasOcorrencias.filter(function (ocorrencia) {
        return (
            ocorrencia.setor === "Handling" ||
            (ocorrencia.areas || []).includes("Handling")
        ) && ocorrencia.status !== "Encerrada";
    });

    contadorOcorrencias.textContent = ocorrenciasHandling.length;

    semOcorrencias.style.display =
        ocorrenciasHandling.length === 0 ? "block" : "none";

    ocorrenciasHandling.forEach(criarCard);
}

// CRIAR CARD
function criarCard(ocorrencia) {
    let corStatus = "amarelo";
    let textoStatus = "MÉDIA";

    if (ocorrencia.gravidade === "Alta") {
        corStatus = "vermelho";
        textoStatus = "ALTA";
    } else if (ocorrencia.gravidade === "Baixa") {
        corStatus = "verde";
        textoStatus = "BAIXA";
    }

    const card = document.createElement("div");
    card.classList.add("ocorrencia");

    card.innerHTML = `
        <div class="status-ocorrencia ${corStatus}"></div>

        <div class="informacoes-ocorrencia">
            <div class="linha-superior">
                <strong>${escaparHTML(ocorrencia.voo || "Voo não informado")}</strong>

                <span class="status texto-${corStatus}">
                    ${textoStatus}
                </span>
            </div>

            <h4>${escaparHTML(ocorrencia.tipo || "Ocorrência operacional")}</h4>

            <p>${escaparHTML(ocorrencia.descricao || "Sem descrição")}</p>

            <div class="detalhes">
                <span>✈ ${escaparHTML(ocorrencia.aeronave || "Não informada")}</span>
                <span>🔧 ${escaparHTML(ocorrencia.setor || "Não informado")}</span>
                <span>● ${escaparHTML(ocorrencia.status || "Em andamento")}</span>
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

    // VER DETALHES
    card.querySelector(".botao-ver").addEventListener("click", function () {
        alert(
            "DETALHES DA OCORRÊNCIA\n\n" +
            "Voo: " + (ocorrencia.voo || "Não informado") +
            "\nAeronave: " + (ocorrencia.aeronave || "Não informada") +
            "\nTipo: " + (ocorrencia.tipo || "Não informado") +
            "\nGravidade: " + (ocorrencia.gravidade || "Não informada") +
            "\nDescrição: " + (ocorrencia.descricao || "Sem descrição") +
            "\nSetor responsável: " + (ocorrencia.setor || "Não informado") +
            "\nÁreas afetadas: " + (ocorrencia.areas || []).join(", ") +
            "\nStatus: " + (ocorrencia.status || "Em andamento")
        );
    });

    // ENCERRAR OCORRÊNCIA
    // SOMENTE O CRIADOR OU O CCO PODE ENCERRAR
    const podeEncerrar =
        usuarioAtual &&
        (
            usuarioAtual.email === "cco@icoa.com" ||
            ocorrencia.criadoPorUid === usuarioAtual.uid
        );

    const botaoEncerrar = card.querySelector(".botao-encerrar");

    if (!podeEncerrar) {
        botaoEncerrar.style.display = "none";
    }

    botaoEncerrar.addEventListener("click", async function () {
        if (!podeEncerrar) {
            alert("Você não tem permissão para encerrar esta ocorrência.");
            return;
        }

        if (!confirm("Deseja realmente encerrar esta ocorrência?")) {
            return;
        }

        botaoEncerrar.disabled = true;

        try {
            await updateDoc(
                doc(db, "ocorrencias", ocorrencia.id),
                {
                    status: "Encerrada"
                }
            );

            alert("Ocorrência encerrada com sucesso!");
        } catch (erro) {
            console.error("Erro ao encerrar ocorrência:", erro);
            alert("Não foi possível encerrar. Verifique as regras do Firestore.");
            botaoEncerrar.disabled = false;
        }
    });

    // EXCLUIR OCORRÊNCIA
    // SOMENTE O CRIADOR OU O CCO PODE EXCLUIR
    const podeExcluir =
        usuarioAtual &&
        (
            usuarioAtual.email === "cco@icoa.com" ||
            ocorrencia.criadoPorUid === usuarioAtual.uid
        );

    const botaoExcluir = card.querySelector(".botao-excluir");

    if (!podeExcluir) {
        botaoExcluir.style.display = "none";
    }

    botaoExcluir.addEventListener("click", async function () {
        if (!podeExcluir) {
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

// REGISTRAR OCORRÊNCIA NO FIRESTORE
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
        voo: voo,
        aeronave: aeronave,
        tipo: tipo,
        gravidade: gravidade,
        descricao: descricao,
        setor: "Handling",
        areas: areas,
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

// VERIFICAR LOGIN E ESCUTAR ATUALIZAÇÕES EM TEMPO REAL
onAuthStateChanged(auth, function (usuario) {
    if (!usuario) {
        window.location.href = "../index.html";
        return;
    }

    usuarioAtual = usuario;

    if (pararDeEscutar) {
        pararDeEscutar();
    }

    pararDeEscutar = onSnapshot(
        collection(db, "ocorrencias"),
        function (resultado) {
            mostrarOcorrencias(resultado.docs);
        },
        function (erro) {
            console.error("Erro ao carregar ocorrências:", erro);
            alert("Não foi possível carregar as ocorrências. Confira as regras do Firestore.");
        }
    );






    
/* =====================================
   CONTADOR DE COMUNICAÇÕES NÃO LIDAS
   ===================================== */

const contadorComunicacoes = document.getElementById(
    "contadorComunicacoes"
);

onAuthStateChanged(auth, (usuario) => {
    if (!usuario) return;

    onSnapshot(
        collection(db, "comunicacoes"),
        (snapshot) => {
            const quantidadeNaoLidas = snapshot.docs.filter((documento) => {
                const mensagem = documento.data();

                return (
                    mensagem.destinatario === "Handling" &&
                    mensagem.lida !== true
                );
            }).length;

            if (contadorComunicacoes) {
                contadorComunicacoes.textContent = quantidadeNaoLidas;
            }

            console.log(
                "Comunicações não lidas do Handling:",
                quantidadeNaoLidas
            );
        },
        (erro) => {
            console.error(
                "Erro ao atualizar o contador de comunicações:",
                erro
            );
        }
    );
});

});
