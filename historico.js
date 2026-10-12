
import { db, auth } from "./firebase.js";

import {
    collection,
    onSnapshot
} from "firebase/firestore";

import {
    onAuthStateChanged
} from "firebase/auth";

const listaHistorico = document.getElementById("listaHistorico");
const semHistorico = document.getElementById("semHistorico");

// Evita que textos das ocorrências sejam interpretados como HTML.
function escaparHTML(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, function (letra) {
        const caracteres = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return caracteres[letra];
    });
}

// Formata a data registrada no Firebase.
function formatarData(data) {
    if (!data) {
        return "Data não informada";
    }

    const dataReal = typeof data.toDate === "function"
        ? data.toDate()
        : new Date(data);

    if (Number.isNaN(dataReal.getTime())) {
        return "Data não informada";
    }

    return dataReal.toLocaleString("pt-BR");
}

// Verifica se o usuário está autenticado.
onAuthStateChanged(auth, function (usuario) {
    if (!usuario) {
        if (listaHistorico) {
            listaHistorico.innerHTML = "";
        }

        if (semHistorico) {
            semHistorico.style.display = "block";
            semHistorico.textContent =
                "Faça login para consultar o histórico.";
        }

        return;
    }

    // Busca as ocorrências salvas no Firestore.
    onSnapshot(
        collection(db, "ocorrencias"),

        function (snapshot) {
            if (!listaHistorico || !semHistorico) {
                console.error(
                    'O HTML precisa conter os elementos "listaHistorico" e "semHistorico".'
                );
                return;
            }

            const ocorrenciasEncerradas = [];

            snapshot.forEach(function (documento) {
                const ocorrencia = documento.data();

                if (ocorrencia.status === "Encerrada") {
                    ocorrenciasEncerradas.push({
                        id: documento.id,
                        ...ocorrencia
                    });
                }
            });

            // Mostra as mais recentes primeiro.
            ocorrenciasEncerradas.sort(function (a, b) {
                const dataA = a.criadoEm?.toDate
                    ? a.criadoEm.toDate().getTime()
                    : 0;

                const dataB = b.criadoEm?.toDate
                    ? b.criadoEm.toDate().getTime()
                    : 0;

                return dataB - dataA;
            });

            listaHistorico.innerHTML = "";

            // Exibe a mensagem quando não há registros.
            if (ocorrenciasEncerradas.length === 0) {
                semHistorico.style.display = "block";
                semHistorico.textContent =
                    "Nenhuma ocorrência encerrada foi encontrada.";
                return;
            }

            semHistorico.style.display = "none";

            // Cria um card para cada ocorrência encerrada.
            ocorrenciasEncerradas.forEach(function (ocorrencia) {
                const card = document.createElement("div");
                card.classList.add("card-historico");

                card.innerHTML = `
                    <div class="status-historico"></div>

                    <div class="informacoes-historico">

                        <div class="linha-superior-historico">
                            <strong>
                                ${escaparHTML(ocorrencia.voo || "Voo não informado")}
                            </strong>

                            <span class="status-encerrada">
                                ENCERRADA
                            </span>
                        </div>

                        <h4>
                            ${escaparHTML(ocorrencia.tipo || "Ocorrência")}
                        </h4>

                        <p>
                            ${escaparHTML(ocorrencia.descricao || "Sem descrição.")}
                        </p>

                        <div class="detalhes-historico">
                            <span>
                                ✈ ${escaparHTML(ocorrencia.aeronave || "Aeronave não informada")}
                            </span>

                            <span>
                                ⚠ ${escaparHTML(ocorrencia.gravidade || "Não informada")}
                            </span>

                            <span>
                                🔧 ${escaparHTML(ocorrencia.setor || "Setor não informado")}
                            </span>
                        </div>

                        <p class="data-historico">
                            Registrada em:
                            ${escaparHTML(formatarData(ocorrencia.criadoEm))}
                        </p>

                    </div>

                    <button
                        class="botao-detalhes"
                        type="button"
                    >
                        Ver detalhes
                    </button>
                `;

                // Abre os detalhes da ocorrência.
                card.querySelector(".botao-detalhes").addEventListener(
                    "click",
                    function () {
                        alert(
                            "DETALHES DA OCORRÊNCIA\n\n" +
                            "Voo: " + (ocorrencia.voo || "Não informado") + "\n" +
                            "Aeronave: " + (ocorrencia.aeronave || "Não informada") + "\n" +
                            "Tipo: " + (ocorrencia.tipo || "Não informado") + "\n" +
                            "Gravidade: " + (ocorrencia.gravidade || "Não informada") + "\n" +
                            "Descrição: " + (ocorrencia.descricao || "Sem descrição") + "\n" +
                            "Setor responsável: " + (ocorrencia.setor || "Não informado") + "\n" +
                            "Data do registro: " + formatarData(ocorrencia.criadoEm) + "\n" +
                            "Status: Encerrada"
                        );
                    }
                );

                listaHistorico.appendChild(card);
            });
        },

        function (erro) {
            console.error("Erro ao carregar o histórico:", erro);

            if (semHistorico) {
                semHistorico.style.display = "block";
                semHistorico.textContent =
                    "Não foi possível carregar o histórico. Verifique a conexão e as permissões do Firebase.";
            }
        }
    );
});
