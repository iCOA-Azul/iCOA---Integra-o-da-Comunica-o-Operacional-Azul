
import { db, auth } from "../firebase.js";

import {
    collection,
    addDoc,
    onSnapshot,
    serverTimestamp,
    deleteDoc,
    doc
} from "firebase/firestore";

import { onAuthStateChanged } from "firebase/auth";

// ========================================
// ELEMENTOS DA PÁGINA
// ========================================

const listaOcorrencias = document.getElementById("listaOcorrencias");
const semOcorrencias = document.getElementById("semOcorrencias");
const botaoNovoImpacto = document.getElementById("novoImpacto");

const contadorImpactos = document.getElementById("contadorImpactos");
const contadorAvisos = document.getElementById("contadorAvisos");
const contadorComunicacoes = document.getElementById("contadorComunicacoes");

const listaAvisos = document.getElementById("listaAvisos");
const semAvisos = document.getElementById("semAvisos");

const modalRegistro = document.getElementById("modalRegistro");
const formOcorrencia = document.getElementById("formOcorrencia");
const botaoSalvar = document.getElementById("salvarOcorrencia");

let pararOcorrencias = null;
let pararComunicacoes = null;
let enviando = false;

// ========================================
// PROTEGER TEXTOS EXIBIDOS NA PÁGINA
// ========================================

function escaparHTML(valor = "") {
    return String(valor).replace(/[&<>"']/g, caractere => {
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

function formatarHorario(timestamp) {
    if (!timestamp?.toDate) {
        return "Horário não disponível";
    }

    return timestamp.toDate().toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}

// ========================================
// ABRIR E FECHAR O FORMULÁRIO
// ========================================

function abrirModal() {
    modalRegistro.classList.add("ativo");
    modalRegistro.setAttribute("aria-hidden", "false");
}

function fecharModal() {
    modalRegistro.classList.remove("ativo");
    modalRegistro.setAttribute("aria-hidden", "true");
}

botaoNovoImpacto.addEventListener("click", abrirModal);

document.getElementById("fecharModal").addEventListener("click", fecharModal);
document.getElementById("cancelarRegistro").addEventListener("click", fecharModal);

modalRegistro.addEventListener("click", evento => {
    if (evento.target === modalRegistro) {
        fecharModal();
    }
});

// ========================================
// REGISTRAR OCORRÊNCIA E AVISAR AS ÁREAS
// ========================================

formOcorrencia.addEventListener("submit", async evento => {
    evento.preventDefault();

    if (enviando) return;

    const usuario = auth.currentUser;

    if (!usuario) {
        alert("Sua sessão expirou. Entre novamente no sistema.");
        return;
    }

    const tipo = document.getElementById("tipoOcorrencia").value;
    const voo = document.getElementById("vooOcorrencia").value.trim();
    const aeronave = document.getElementById("aeronaveOcorrencia").value.trim();
    const gravidade = document.getElementById("gravidadeOcorrencia").value;
    const descricao = document.getElementById("descricaoOcorrencia").value.trim();

    const areas = Array.from(
        formOcorrencia.querySelectorAll('input[name="areas"]:checked')
    ).map(campo => campo.value);

    if (areas.length === 0) {
        alert("Selecione pelo menos uma área para receber o aviso.");
        return;
    }

    if (!tipo || !gravidade || !descricao) {
        alert("Preencha o tipo, a gravidade e a descrição.");
        return;
    }

    enviando = true;
    botaoSalvar.disabled = true;
    botaoSalvar.textContent = "Registrando...";

    let ocorrenciaSalva = false;

    try {
        // 1. SALVAR A OCORRÊNCIA

        const referenciaOcorrencia = await addDoc(
            collection(db, "ocorrencias"),
            {
                voo,
                aeronave,
                tipo,
                gravidade,
                descricao,
                setor: "Comercial",
                areas,
                status: "Em andamento",
                criadoPorUid: usuario.uid,
                criadoEm: serverTimestamp()
            }
        );

        ocorrenciaSalva = true;

        // 2. PREPARAR O TEXTO DOS AVISOS

        const textoAviso =
            `Nova ocorrência registrada pelo Comercial: ${tipo}. ` +
            `Voo: ${voo || "Não informado"}. ` +
            `Gravidade: ${gravidade}. ` +
            `Descrição: ${descricao}`;

        // 3. TENTAR ENVIAR CADA AVISO INDIVIDUALMENTE

        const resultados = await Promise.allSettled(
            areas.map(destinatario =>
                addDoc(collection(db, "comunicacoes"), {
                    remetente: "Comercial",
                    remetenteUid: usuario.uid,
                    destinatario,
                    texto: textoAviso,
                    criadoEm: serverTimestamp(),
                    lida: false,
                    ocorrenciaId: referenciaOcorrencia.id
                })
            )
        );

        // 4. IDENTIFICAR OS AVISOS QUE FALHARAM

        const falhas = resultados
            .map((resultado, indice) => ({
                resultado,
                setor: areas[indice]
            }))
            .filter(item => item.resultado.status === "rejected");

        if (falhas.length > 0) {
            console.error(
                "Falha ao enviar avisos:",
                falhas.map(item => ({
                    setor: item.setor,
                    erro: item.resultado.reason
                }))
            );

            const setoresComFalha = falhas
                .map(item => item.setor)
                .join(", ");

            alert(
                "A ocorrência foi salva, mas houve falha ao enviar " +
                "alguns avisos.\n\n" +
                "Setor(es) com falha: " + setoresComFalha +
                "\n\nAbra o Console (F12) para ver o erro."
            );
        } else {
            alert(
                "Ocorrência registrada com sucesso!\n\n" +
                "Todos os avisos foram enviados para: " +
                areas.join(", ")
            );
        }

        formOcorrencia.reset();
        fecharModal();

    } catch (erro) {
        console.error("Erro ao registrar ocorrência ou avisos:", erro);

        if (ocorrenciaSalva) {
            alert(
                "A ocorrência foi salva, mas aconteceu um erro durante " +
                "o processamento dos avisos.\n\n" +
                "Abra o Console (F12) para verificar o erro."
            );
        } else {
            alert(
                "Não foi possível registrar a ocorrência.\n\n" +
                "Verifique sua conexão e as regras de acesso do Firestore."
            );
        }
    } finally {
        enviando = false;
        botaoSalvar.disabled = false;
        botaoSalvar.textContent = "Registrar e avisar setores";
    }
});

// ========================================
// CRIAR CARTÃO DE OCORRÊNCIA
// ========================================

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

    const card = document.createElement("article");
    card.className = "ocorrencia";

    card.innerHTML = `
        <div class="status-ocorrencia ${corStatus}"></div>

        <div class="informacoes-ocorrencia">
            <div class="linha-superior">
                <strong>${escaparHTML(ocorrencia.voo || "Voo não informado")}</strong>
                <span class="status texto-${corStatus}">${textoStatus}</span>
            </div>

            <h4>${escaparHTML(ocorrencia.tipo || "Ocorrência comercial")}</h4>

            <p>${escaparHTML(ocorrencia.descricao || "Sem descrição")}</p>

            <div class="detalhes">
                <span>✈ ${escaparHTML(ocorrencia.aeronave || "Não informada")}</span>
                <span>Setor: ${escaparHTML(ocorrencia.setor || "Comercial")}</span>
                <span>Status: ${escaparHTML(ocorrencia.status || "Em andamento")}</span>
                <span>Áreas: ${escaparHTML(
                    Array.isArray(ocorrencia.areas)
                        ? ocorrencia.areas.join(", ")
                        : "Não informadas"
                )}</span>
            </div>

            <button class="botao-ver" type="button">Ver detalhes</button>
        </div>
    `;

    // VER DETALHES DA OCORRÊNCIA

    card.querySelector(".botao-ver").addEventListener("click", () => {
        alert(
            "DETALHES DA OCORRÊNCIA\n\n" +
            "Voo: " + (ocorrencia.voo || "Não informado") +
            "\nAeronave: " + (ocorrencia.aeronave || "Não informada") +
            "\nTipo: " + (ocorrencia.tipo || "Não informado") +
            "\nGravidade: " + (ocorrencia.gravidade || "Não informada") +
            "\nDescrição: " + (ocorrencia.descricao || "Sem descrição") +
            "\nSetor responsável: " + (ocorrencia.setor || "Não informado") +
            "\nÁreas envolvidas: " +
            (Array.isArray(ocorrencia.areas)
                ? ocorrencia.areas.join(", ")
                : "Não informadas") +
            "\nStatus: " + (ocorrencia.status || "Em andamento")
        );
    });

    // EXCLUIR SOMENTE A PRÓPRIA OCORRÊNCIA

    const usuarioAtual = auth.currentUser;

    if (
        usuarioAtual &&
        ocorrencia.criadoPorUid === usuarioAtual.uid
    ) {
        const botaoExcluir = document.createElement("button");

        botaoExcluir.type = "button";
        botaoExcluir.className = "botao-ver";
        botaoExcluir.textContent = "Excluir";

        botaoExcluir.addEventListener("click", async () => {
            const confirmou = confirm(
                "Tem certeza de que deseja excluir esta ocorrência?"
            );

            if (!confirmou) return;

            botaoExcluir.disabled = true;
            botaoExcluir.textContent = "Excluindo...";

            try {
                await deleteDoc(
                    doc(db, "ocorrencias", ocorrencia.id)
                );

                alert("Ocorrência excluída com sucesso!");

            } catch (erro) {
                console.error("Erro ao excluir ocorrência:", erro);

                alert(
                    "Não foi possível excluir a ocorrência.\n\n" +
                    "Verifique as permissões do Firebase."
                );

                botaoExcluir.disabled = false;
                botaoExcluir.textContent = "Excluir";
            }
        });

        card.querySelector(".informacoes-ocorrencia")
            .appendChild(botaoExcluir);
    }

    listaOcorrencias.appendChild(card);
}

// ========================================
// EXIBIR OCORRÊNCIAS DIRECIONADAS AO COMERCIAL
// ========================================

function mostrarOcorrencias(documentos) {
    listaOcorrencias
        .querySelectorAll(".ocorrencia")
        .forEach(card => card.remove());

    const ocorrencias = documentos
        .map(documento => ({
            id: documento.id,
            ...documento.data()
        }))
        .filter(ocorrencia => {
            const direcionadaAoComercial =
                ocorrencia.setor === "Comercial" ||
                (
                    Array.isArray(ocorrencia.areas) &&
                    ocorrencia.areas.includes("Comercial")
                );

            return direcionadaAoComercial &&
                ocorrencia.status !== "Encerrada";
        });

    if (contadorImpactos) {
        contadorImpactos.textContent = ocorrencias.length;
    }

    semOcorrencias.style.display =
        ocorrencias.length === 0 ? "block" : "none";

    ocorrencias.forEach(criarCard);
}

// ========================================
// EXIBIR AVISOS RECEBIDOS PELO COMERCIAL
// ========================================

function mostrarAvisos(mensagens) {
    listaAvisos
        .querySelectorAll(".aviso-card")
        .forEach(aviso => aviso.remove());

    const recebidas = mensagens
        .filter(mensagem => mensagem.destinatario === "Comercial")
        .sort((a, b) => {
            const dataA = a.criadoEm?.toMillis?.() ?? 0;
            const dataB = b.criadoEm?.toMillis?.() ?? 0;

            return dataB - dataA;
        });

    const naoLidas = recebidas.filter(
        mensagem => mensagem.lida !== true
    );

    if (contadorAvisos) {
        contadorAvisos.textContent = naoLidas.length;
    }

    if (contadorComunicacoes) {
        contadorComunicacoes.textContent = naoLidas.length;
    }

    semAvisos.style.display =
        recebidas.length === 0 ? "block" : "none";

    recebidas.forEach(mensagem => {
        const aviso = document.createElement("article");
        aviso.className = "aviso-card";

        aviso.innerHTML = `
            <div class="aviso-cabecalho">
                <strong>${escaparHTML(mensagem.remetente || "Setor")}</strong>
                <small>${escaparHTML(formatarHorario(mensagem.criadoEm))}</small>
            </div>

            <p>${escaparHTML(mensagem.texto || "")}</p>

            <small>${mensagem.lida === true ? "Lido" : "Não lido"}</small>
        `;

        listaAvisos.appendChild(aviso);
    });
}

// ========================================
// LOGIN E ATUALIZAÇÃO EM TEMPO REAL
// ========================================

onAuthStateChanged(auth, usuario => {
    if (pararOcorrencias) {
        pararOcorrencias();
        pararOcorrencias = null;
    }

    if (pararComunicacoes) {
        pararComunicacoes();
        pararComunicacoes = null;
    }

    if (!usuario) {
        window.location.href = "../index.html";
        return;
    }

    pararOcorrencias = onSnapshot(
        collection(db, "ocorrencias"),
        resultado => {
            mostrarOcorrencias(resultado.docs);
        },
        erro => {
            console.error("Erro ao carregar ocorrências:", erro);
        }
    );

    pararComunicacoes = onSnapshot(
        collection(db, "comunicacoes"),
        resultado => {
            const mensagens = resultado.docs.map(documento => ({
                id: documento.id,
                ...documento.data()
            }));

            mostrarAvisos(mensagens);
        },
        erro => {
            console.error("Erro ao carregar comunicações:", erro);
        }
    );
});

console.log("iCOA — Comercial carregado.");
