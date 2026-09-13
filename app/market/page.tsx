
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";

type Opportunity = {
  id: string;
  market: string;
  asset: string;
  direction: string;
  entry: string;
  stopLoss: string;
  takeProfit: string;
  risk: string;
  analysis: string;
};

type AccessRequest = {
  id: string;
  userId: string;
  opportunityId: string;
  status: string;
};

type DepositMethod = "CARD" | "CRYPTO" | "";

type Language = "pt" | "en" | "es";

type SupportMessage = {
  id: string;
  senderId: string;
  senderType: "user" | "admin";
  message: string;
  createdAt?: any;
};

const markets = [
  {
    name: "Crypto",
    icon: "₿",
    description: "Bitcoin, Ethereum e outras criptomoedas",
  },
  {
    name: "Forex",
    icon: "💱",
    description: "Pares de moedas internacionais",
  },
  {
    name: "Acoes",
    icon: "📈",
    description: "Mercados de ações",
  },
  {
    name: "Indices",
    icon: "📊",
    description: "Principais índices mundiais",
  },
  {
    name: "Commodities",
    icon: "🥇",
    description: "Ouro, petróleo e outros ativos",
  },
];

const depositAmounts = [
  100,
  250,
  500,
  1000,
  2500,
  5000,
  10000,
  15000,
  20000,
];

const USDT_TRC20_ADDRESS =
  process.env.NEXT_PUBLIC_USDT_TRC20_ADDRESS ||
  "TSKJtcKJHCcztmn9g5VmL8A5xcHiUgepVA";

const translations = {
  pt: {
    home: "Início",
    tradeNow: "Negocie agora",
    withdraw: "Sacar",
    logout: "Sair",
    deposit: "Depositar",
    support: "Apoio ao cliente",
    aiMode: "Modo Inteligência Artificial",
    aiDescription:
      "Ative ou desative o modo de Inteligência Artificial.",
    on: "Ligado",
    off: "Desligado",
    language: "Idioma",
    todayAnalysis: "Análises de hoje",
    chooseMarket: "Escolha o seu mercado",
    chooseMarketDescription:
      "Selecione um mercado para consultar as oportunidades preparadas para hoje.",
    opportunities: "Oportunidades",
    prepared: "Oportunidades preparadas para este mercado.",
    opportunity: "oportunidade",
    opportunitiesPlural: "oportunidades",
    loadingOpportunities: "Carregando oportunidades...",
    noOpportunity: "Nenhuma oportunidade",
    noOpportunityDescription:
      "Ainda não existem oportunidades cadastradas para",
    asset: "Ativo",
    risk: "Risco",
    market: "Mercado",
    status: "Status",
    checking: "Verificando...",
    unlocked: "Desbloqueado",
    locked: "Bloqueado",
    unlockedAnalysis: "Análise desbloqueada",
    accessSignal: "Você possui acesso a este sinal.",
    entry: "Entrada",
    stopLoss: "Stop Loss",
    takeProfit: "Take Profit",
    analysis: "Análise",
    lockedAnalysis: "Análise bloqueada",
    paymentToUnlock:
      "Faça o pagamento para desbloquear este sinal.",
    unlock: "Desbloquear análise",
    verifyingSession: "Verificando sessão...",
    depositTitle: "Depositar",
    depositDescription: "Adicione saldo à sua conta.",
    selectAmount: "1. Selecione o valor",
    customAmount: "Ou digite outro valor",
    amountPlaceholder: "Entre $100 e $20.000",
    selectMethod: "2. Escolha o método de depósito",
    card: "Cartão",
    cardDescription: "Pague com cartão bancário.",
    crypto: "Crypto",
    cryptoDescription: "Deposite usando USDT TRC20.",
    cardPayment: "Pagamento com cartão",
    selectedAmount: "Valor selecionado:",
    cardNumber: "Número do cartão",
    cardName: "Nome no cartão",
    fullName: "Nome completo",
    expiry: "Validade",
    cvv: "CVV",
    continuePayment: "Continuar pagamento",
    cryptoDeposit: "Depósito com Crypto",
    cryptoDescriptionFull:
      "Envie exatamente o valor selecionado em USDT pela rede TRC20.",
    requiredNetwork: "Rede obrigatória",
    networkWarning:
      "Envie somente USDT TRC20. Não envie por ERC20, BEP20 ou outra rede.",
    depositValue: "Valor do depósito",
    usdtAddress: "Endereço USDT TRC20",
    copyAddress: "Copiar endereço",
    addressCopied: "Endereço copiado",
    howToDeposit: "Como depositar",
    step1: "Abra sua carteira.",
    step2: "Selecione USDT.",
    step3: "Escolha a rede TRC20.",
    step4: "Envie o valor para o endereço acima.",
    step5: "Aguarde a confirmação da transação.",
    supportTitle: "Apoio ao cliente",
    supportDescription:
      "Envie uma mensagem e nossa equipe poderá responder.",
    writeMessage: "Escreva sua mensagem...",
    send: "Enviar",
    close: "Fechar",
    withdrawTitle: "Solicitar saque",
    withdrawDescription:
      "Preencha seus dados bancários para receber o saque.",
    name: "Nome",
    iban: "IBAN",
    accountNumber: "Número da conta",
    bank: "Banco",
    saveBankData: "Salvar dados",
    saved: "Dados salvos com sucesso.",
    aiTitle: "Modo de negociação por IA",
    aiInfo:
      "Este botão apenas ativa ou desativa o modo. Nenhuma negociação é executada por esta opção.",
    enabled: "Ativado",
    disabled: "Desativado",
    languageTitle: "Escolha o idioma",
    errorOpportunities:
      "Não foi possível carregar as oportunidades.",
    fillCard: "Preencha todos os dados do cartão.",
    selectDeposit: "Selecione o valor do depósito.",
    messageRequired: "Digite uma mensagem.",
  },

  en: {
    home: "Home",
    tradeNow: "Trade now",
    withdraw: "Withdraw",
    logout: "Logout",
    deposit: "Deposit",
    support: "Customer support",
    aiMode: "Artificial Intelligence Mode",
    aiDescription:
      "Turn the Artificial Intelligence mode on or off.",
    on: "On",
    off: "Off",
    language: "Language",
    todayAnalysis: "Today's analysis",
    chooseMarket: "Choose your market",
    chooseMarketDescription:
      "Select a market to view today's opportunities.",
    opportunities: "Opportunities",
    prepared: "Opportunities prepared for this market.",
    opportunity: "opportunity",
    opportunitiesPlural: "opportunities",
    loadingOpportunities: "Loading opportunities...",
    noOpportunity: "No opportunities",
    noOpportunityDescription:
      "There are no opportunities registered for",
    asset: "Asset",
    risk: "Risk",
    market: "Market",
    status: "Status",
    checking: "Checking...",
    unlocked: "Unlocked",
    locked: "Locked",
    unlockedAnalysis: "Analysis unlocked",
    accessSignal: "You have access to this signal.",
    entry: "Entry",
    stopLoss: "Stop Loss",
    takeProfit: "Take Profit",
    analysis: "Analysis",
    lockedAnalysis: "Analysis locked",
    paymentToUnlock:
      "Make the payment to unlock this signal.",
    unlock: "Unlock analysis",
    verifyingSession: "Checking session...",
    depositTitle: "Deposit",
    depositDescription: "Add funds to your account.",
    selectAmount: "1. Select the amount",
    customAmount: "Or enter another amount",
    amountPlaceholder: "Between $100 and $20,000",
    selectMethod: "2. Choose the deposit method",
    card: "Card",
    cardDescription: "Pay with a bank card.",
    crypto: "Crypto",
    cryptoDescription: "Deposit using USDT TRC20.",
    cardPayment: "Card payment",
    selectedAmount: "Selected amount:",
    cardNumber: "Card number",
    cardName: "Name on card",
    fullName: "Full name",
    expiry: "Expiry",
    cvv: "CVV",
    continuePayment: "Continue payment",
    cryptoDeposit: "Crypto deposit",
    cryptoDescriptionFull:
      "Send exactly the selected amount in USDT through the TRC20 network.",
    requiredNetwork: "Required network",
    networkWarning:
      "Send USDT TRC20 only. Do not send through ERC20, BEP20 or another network.",
    depositValue: "Deposit amount",
    usdtAddress: "USDT TRC20 address",
    copyAddress: "Copy address",
    addressCopied: "Address copied",
    howToDeposit: "How to deposit",
    step1: "Open your wallet.",
    step2: "Select USDT.",
    step3: "Choose the TRC20 network.",
    step4: "Send the amount to the address above.",
    step5: "Wait for the transaction confirmation.",
    supportTitle: "Customer support",
    supportDescription:
      "Send a message and our team can reply.",
    writeMessage: "Write your message...",
    send: "Send",
    close: "Close",
    withdrawTitle: "Withdraw",
    withdrawDescription:
      "Enter your bank details to receive the withdrawal.",
    name: "Name",
    iban: "IBAN",
    accountNumber: "Account number",
    bank: "Bank",
    saveBankData: "Save details",
    saved: "Details saved successfully.",
    aiTitle: "AI trading mode",
    aiInfo:
      "This button only turns the mode on or off. No trades are executed by this option.",
    enabled: "Enabled",
    disabled: "Disabled",
    languageTitle: "Choose language",
    errorOpportunities:
      "Unable to load opportunities.",
    fillCard: "Please fill in all card details.",
    selectDeposit: "Select the deposit amount.",
    messageRequired: "Enter a message.",
  },

  es: {
    home: "Inicio",
    tradeNow: "Negociar ahora",
    withdraw: "Retirar",
    logout: "Salir",
    deposit: "Depositar",
    support: "Soporte al cliente",
    aiMode: "Modo de Inteligencia Artificial",
    aiDescription:
      "Activa o desactiva el modo de Inteligencia Artificial.",
    on: "Activado",
    off: "Desactivado",
    language: "Idioma",
    todayAnalysis: "Análisis de hoy",
    chooseMarket: "Elige tu mercado",
    chooseMarketDescription:
      "Selecciona un mercado para consultar las oportunidades de hoy.",
    opportunities: "Oportunidades",
    prepared: "Oportunidades preparadas para este mercado.",
    opportunity: "oportunidad",
    opportunitiesPlural: "oportunidades",
    loadingOpportunities: "Cargando oportunidades...",
    noOpportunity: "Ninguna oportunidad",
    noOpportunityDescription:
      "Todavía no hay oportunidades registradas para",
    asset: "Activo",
    risk: "Riesgo",
    market: "Mercado",
    status: "Estado",
    checking: "Verificando...",
    unlocked: "Desbloqueado",
    locked: "Bloqueado",
    unlockedAnalysis: "Análisis desbloqueado",
    accessSignal: "Tienes acceso a esta señal.",
    entry: "Entrada",
    stopLoss: "Stop Loss",
    takeProfit: "Take Profit",
    analysis: "Análisis",
    lockedAnalysis: "Análisis bloqueado",
    paymentToUnlock:
      "Realiza el pago para desbloquear esta señal.",
    unlock: "Desbloquear análisis",
    verifyingSession: "Verificando sesión...",
    depositTitle: "Depositar",
    depositDescription: "Añade saldo a tu cuenta.",
    selectAmount: "1. Selecciona el valor",
    customAmount: "O introduce otro valor",
    amountPlaceholder: "Entre $100 y $20.000",
    selectMethod: "2. Elige el método de depósito",
    card: "Tarjeta",
    cardDescription: "Paga con tarjeta bancaria.",
    crypto: "Crypto",
    cryptoDescription: "Deposita usando USDT TRC20.",
    cardPayment: "Pago con tarjeta",
    selectedAmount: "Valor seleccionado:",
    cardNumber: "Número de tarjeta",
    cardName: "Nombre en la tarjeta",
    fullName: "Nombre completo",
    expiry: "Vencimiento",
    cvv: "CVV",
    continuePayment: "Continuar pago",
    cryptoDeposit: "Depósito con Crypto",
    cryptoDescriptionFull:
      "Envía exactamente el valor seleccionado en USDT por la red TRC20.",
    requiredNetwork: "Red obligatoria",
    networkWarning:
      "Envía solamente USDT TRC20. No envíes por ERC20, BEP20 u otra red.",
    depositValue: "Valor del depósito",
    usdtAddress: "Dirección USDT TRC20",
    copyAddress: "Copiar dirección",
    addressCopied: "Dirección copiada",
    howToDeposit: "Cómo depositar",
    step1: "Abre tu cartera.",
    step2: "Selecciona USDT.",
    step3: "Elige la red TRC20.",
    step4: "Envía el valor a la dirección indicada.",
    step5: "Espera la confirmación de la transacción.",
    supportTitle: "Soporte al cliente",
    supportDescription:
      "Envía un mensaje y nuestro equipo podrá responder.",
    writeMessage: "Escribe tu mensaje...",
    send: "Enviar",
    close: "Cerrar",
    withdrawTitle: "Solicitar retiro",
    withdrawDescription:
      "Completa tus datos bancarios para recibir el retiro.",
    name: "Nombre",
    iban: "IBAN",
    accountNumber: "Número de cuenta",
    bank: "Banco",
    saveBankData: "Guardar datos",
    saved: "Datos guardados correctamente.",
    aiTitle: "Modo de negociación con IA",
    aiInfo:
      "Este botón solo activa o desactiva el modo. Esta opción no ejecuta ninguna operación.",
    enabled: "Activado",
    disabled: "Desactivado",
    languageTitle: "Elegir idioma",
    errorOpportunities:
      "No se pudieron cargar las oportunidades.",
    fillCard: "Completa todos los datos de la tarjeta.",
    selectDeposit: "Selecciona el valor del depósito.",
    messageRequired: "Escribe un mensaje.",
  },
};

export default function MarketPage() {
  const router = useRouter();

  const [selectedMarket, setSelectedMarket] = useState("Crypto");
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [activeAccesses, setActiveAccesses] = useState<string[]>([]);
  const [checkingAccess, setCheckingAccess] = useState(false);

  /*
   * MENU
   */
  const [menuOpen, setMenuOpen] = useState(false);

  /*
   * DEPÓSITO
   */
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number | null>(null);
  const [depositMethod, setDepositMethod] =
    useState<DepositMethod>("");
  const [copiedAddress, setCopiedAddress] = useState(false);

  /*
   * DADOS DO CARTÃO
   */
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  /*
   * APOIO AO CLIENTE
   */
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const [supportMessages, setSupportMessages] =
    useState<SupportMessage[]>([]);
  const [sendingSupport, setSendingSupport] = useState(false);

  /*
   * MODO IA
   */
  const [aiMode, setAiMode] = useState(false);
  const [savingAiMode, setSavingAiMode] = useState(false);

  /*
   * SAQUE
   */
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawName, setWithdrawName] = useState("");
  const [withdrawIban, setWithdrawIban] = useState("");
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState("");
  const [withdrawBank, setWithdrawBank] = useState("");
  const [savingWithdraw, setSavingWithdraw] = useState(false);
  const [withdrawSaved, setWithdrawSaved] = useState(false);

  /*
   * IDIOMA
   */
  const [language, setLanguage] = useState<Language>("pt");
  const [languageOpen, setLanguageOpen] = useState(false);

  const t = translations[language];

  /*
   * VERIFICAR LOGIN
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setCheckingAuth(false);

      if (!currentUser) {
        router.replace("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  /*
   * CARREGAR OPORTUNIDADES
   */
  useEffect(() => {
    async function loadOpportunities() {
      try {
        setLoading(true);
        setError("");

        const opportunitiesRef = collection(db, "opportunities");

        const opportunitiesQuery = query(
          opportunitiesRef,
          orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(opportunitiesQuery);

        const data: Opportunity[] = snapshot.docs.map((item) => {
          const data = item.data();

          return {
            id: item.id,
            market: data.market || "",
            asset: data.asset || "",
            direction: data.direction || "",
            entry: data.entry || "",
            stopLoss: data.stopLoss || "",
            takeProfit: data.takeProfit || "",
            risk: data.risk || "",
            analysis: data.analysis || "",
          };
        });

        setOpportunities(data);
      } catch (err) {
        console.error("Erro ao carregar oportunidades:", err);
        setError(t.errorOpportunities);
      } finally {
        setLoading(false);
      }
    }

    loadOpportunities();
  }, []);

  /*
   * VERIFICAR ACESSOS DO CLIENTE
   */
  useEffect(() => {
    async function loadAccesses() {
      if (!user) {
        setActiveAccesses([]);
        return;
      }

      try {
        setCheckingAccess(true);

        const accessesRef = collection(db, "accesses");

        const accessesQuery = query(
          accessesRef,
          where("userId", "==", user.uid),
          where("status", "==", "active")
        );

        const snapshot = await getDocs(accessesQuery);

        const activeIds: string[] = snapshot.docs
          .map((item) => {
            const data = item.data() as AccessRequest;
            return data.opportunityId;
          })
          .filter(Boolean);

        setActiveAccesses(activeIds);
      } catch (err) {
        console.error("Erro ao verificar acessos:", err);
        setActiveAccesses([]);
      } finally {
        setCheckingAccess(false);
      }
    }

    loadAccesses();
  }, [user]);

  /*
   * CARREGAR PREFERÊNCIAS DO CLIENTE
   */
  useEffect(() => {
    if (!user) return;

    async function loadUserSettings() {
      try {
        const userRef = doc(db, "users", user!.uid);
        const snapshot = await getDoc(userRef);

        if (!snapshot.exists()) return;

        const data = snapshot.data();

        if (
          data.language === "pt" ||
          data.language === "en" ||
          data.language === "es"
        ) {
          setLanguage(data.language);
        }

        if (typeof data.aiMode === "boolean") {
          setAiMode(data.aiMode);
        }

        if (data.withdrawal) {
          setWithdrawName(data.withdrawal.name || "");
          setWithdrawIban(data.withdrawal.iban || "");
          setWithdrawAccountNumber(
            data.withdrawal.accountNumber || ""
          );
          setWithdrawBank(data.withdrawal.bank || "");
        }
      } catch (err) {
        console.error(
          "Erro ao carregar preferências do cliente:",
          err
        );
      }
    }

    loadUserSettings();
  }, [user]);

  /*
   * CARREGAR CHAT EM TEMPO REAL
   */
  useEffect(() => {
    if (!user) return;

    const messagesRef = collection(
      db,
      "supportChats",
      user.uid,
      "messages"
    );

    const messagesQuery = query(
      messagesRef,
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const messages: SupportMessage[] = snapshot.docs.map(
          (item) => ({
            id: item.id,
            ...(item.data() as Omit<SupportMessage, "id">),
          })
        );

        setSupportMessages(messages);
      },
      (err) => {
        console.error("Erro ao carregar chat:", err);
      }
    );

    return () => unsubscribe();
  }, [user]);

  /*
   * LOGOUT
   */
  async function handleLogout() {
    try {
      await signOut(auth);
      router.replace("/");
    } catch (err) {
      console.error("Erro ao sair:", err);
    }
  }

  /*
   * DESBLOQUEAR
   */
  function handleUnlock(opportunity: Opportunity) {
    if (!user) {
      router.push("/login");
      return;
    }

    router.push(
      `/deposit?opportunityId=${encodeURIComponent(
        opportunity.id
      )}&asset=${encodeURIComponent(
        opportunity.asset
      )}&market=${encodeURIComponent(
        opportunity.market
      )}`
    );
  }

  /*
   * VERIFICAR ACESSO
   */
  function hasAccess(opportunityId: string) {
    return activeAccesses.includes(opportunityId);
  }

  /*
   * ABRIR DEPÓSITO
   */
  function openDeposit() {
    setMenuOpen(false);
    setDepositOpen(true);
    setDepositAmount(null);
    setDepositMethod("");
    setCopiedAddress(false);
  }

  /*
   * FECHAR DEPÓSITO
   */
  function closeDeposit() {
    setDepositOpen(false);
    setDepositAmount(null);
    setDepositMethod("");
    setCopiedAddress(false);

    setCardNumber("");
    setCardName("");
    setCardExpiry("");
    setCardCvv("");
  }

  /*
   * COPIAR ENDEREÇO CRYPTO
   */
  async function copyCryptoAddress() {
    if (!USDT_TRC20_ADDRESS) {
      return;
    }

    try {
      await navigator.clipboard.writeText(USDT_TRC20_ADDRESS);
      setCopiedAddress(true);

      setTimeout(() => {
        setCopiedAddress(false);
      }, 2500);
    } catch (err) {
      console.error("Erro ao copiar endereço:", err);
    }
  }

  /*
   * SUBMIT CARTÃO
   *
   * Mantido como estava:
   * neste momento apenas valida os dados visualmente.
   */
  function handleCardDeposit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!depositAmount) {
      alert(t.selectDeposit);
      return;
    }

    if (
      !cardNumber.trim() ||
      !cardName.trim() ||
      !cardExpiry.trim() ||
      !cardCvv.trim()
    ) {
      alert(t.fillCard);
      return;
    }

    alert(
      `Depósito de $${depositAmount.toLocaleString(
        "en-US"
      )} selecionado. O processamento do cartão será integrado ao gateway de pagamento.`
    );
  }

  /*
   * ENVIAR MENSAGEM AO APOIO
   */
  async function sendSupportMessage() {
    if (!user) return;

    const message = supportMessage.trim();

    if (!message) {
      alert(t.messageRequired);
      return;
    }

    try {
      setSendingSupport(true);

      const messagesRef = collection(
        db,
        "supportChats",
        user.uid,
        "messages"
      );

      await addDoc(messagesRef, {
        senderId: user.uid,
        senderType: "user",
        message,
        createdAt: serverTimestamp(),
      });

      setSupportMessage("");
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
      alert("Não foi possível enviar a mensagem.");
    } finally {
      setSendingSupport(false);
    }
  }

  /*
   * ALTERAR MODO IA
   *
   * IMPORTANTE:
   * Este botão não executa nenhuma negociação.
   */
  async function toggleAiMode() {
    if (!user) return;

    const nextValue = !aiMode;

    try {
      setSavingAiMode(true);

      await setDoc(
        doc(db, "users", user.uid),
        {
          aiMode: nextValue,
        },
        {
          merge: true,
        }
      );

      setAiMode(nextValue);
    } catch (err) {
      console.error("Erro ao salvar modo IA:", err);
    } finally {
      setSavingAiMode(false);
    }
  }

  /*
   * SALVAR DADOS DE SAQUE
   */
  async function saveWithdrawData() {
    if (!user) return;

    if (
      !withdrawName.trim() ||
      !withdrawIban.trim() ||
      !withdrawAccountNumber.trim() ||
      !withdrawBank.trim()
    ) {
      alert("Preencha todos os dados para saque.");
      return;
    }

    try {
      setSavingWithdraw(true);
      setWithdrawSaved(false);

      await setDoc(
        doc(db, "users", user.uid),
        {
          withdrawal: {
            name: withdrawName.trim(),
            iban: withdrawIban.trim(),
            accountNumber: withdrawAccountNumber.trim(),
            bank: withdrawBank.trim(),
            updatedAt: serverTimestamp(),
          },
        },
        {
          merge: true,
        }
      );

      setWithdrawSaved(true);

      setTimeout(() => {
        setWithdrawSaved(false);
      }, 3000);
    } catch (err) {
      console.error("Erro ao salvar dados de saque:", err);
      alert("Não foi possível salvar os dados.");
    } finally {
      setSavingWithdraw(false);
    }
  }

  /*
   * ALTERAR IDIOMA
   */
  async function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    setLanguageOpen(false);

    if (!user) return;

    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          language: nextLanguage,
        },
        {
          merge: true,
        }
      );
    } catch (err) {
      console.error("Erro ao salvar idioma:", err);
    }
  }

  const marketOpportunities = opportunities.filter(
    (opportunity) => opportunity.market === selectedMarket
  );

  /*
   * AGUARDANDO LOGIN
   */
  if (checkingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-white/10 border-t-blue-500 sm:h-10 sm:w-10" />

          <p className="mt-4 text-sm text-slate-400">
            {t.verifyingSession}
          </p>
        </div>
      </main>
    );
  }

  /*
   * SEM LOGIN
   */
  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-950 text-white">

      {/* HEADER */}
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 sm:py-5">

          {/* LOGO */}
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">
              Trade<span className="text-blue-500">Signal</span>
            </h1>

            <p className="text-[11px] text-slate-400 sm:text-xs">
              Daily Market Opportunities
            </p>
          </div>

          {/* AÇÕES DO HEADER */}
          <div className="flex items-center gap-2 sm:gap-3">

            {/* DEPOSITAR */}
            <button
              type="button"
              onClick={openDeposit}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-500 sm:px-5 sm:text-sm"
            >
              💳 {t.deposit}
            </button>

            {/* HAMBURGER */}
            <button
              type="button"
              aria-label="Abrir menu"
              onClick={() => setMenuOpen((value) => !value)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] transition hover:bg-white/10"
            >
              <div className="space-y-1.5">
                <span
                  className={`block h-0.5 w-5 bg-white transition ${
                    menuOpen
                      ? "translate-y-2 rotate-45"
                      : ""
                  }`}
                />
                <span
                  className={`block h-0.5 w-5 bg-white transition ${
                    menuOpen ? "opacity-0" : ""
                  }`}
                />
                <span
                  className={`block h-0.5 w-5 bg-white transition ${
                    menuOpen
                      ? "-translate-y-2 -rotate-45"
                      : ""
                  }`}
                />
              </div>
            </button>
          </div>
        </div>

        {/* MENU */}
        {menuOpen && (
          <div className="border-t border-white/10 bg-slate-950">
            <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">

              <div className="grid gap-2 sm:max-w-xs">

                <Link
                  href="/"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300 transition hover:bg-white/[0.06]"
                >
                  🏠 {t.home}
                </Link>

                <Link
                  href="/broker"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
                >
                  📈 {t.tradeNow}
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setWithdrawOpen(true);
                  }}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-slate-300 transition hover:bg-white/[0.06]"
                >
                  💰 {t.withdraw}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setSupportOpen(true);
                  }}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-slate-300 transition hover:bg-white/[0.06]"
                >
                  💬 {t.support}
                </button>

                {/* MODO IA */}
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">

                  <div className="flex items-center justify-between gap-3">

                    <div>
                      <p className="text-sm font-semibold">
                        🤖 {t.aiMode}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {aiMode ? t.enabled : t.disabled}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={toggleAiMode}
                      disabled={savingAiMode}
                      className={`relative h-7 w-12 rounded-full transition ${
                        aiMode
                          ? "bg-blue-600"
                          : "bg-slate-700"
                      } disabled:opacity-50`}
                    >
                      <span
                        className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                          aiMode
                            ? "left-6"
                            : "left-1"
                        }`}
                      />
                    </button>

                  </div>

                  <p className="mt-3 text-[11px] leading-5 text-slate-500">
                    {t.aiDescription}
                  </p>

                </div>

                {/* IDIOMA */}
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">

                  <button
                    type="button"
                    onClick={() =>
                      setLanguageOpen((value) => !value)
                    }
                    className="flex w-full items-center justify-between text-left"
                  >
                    <span className="text-sm font-semibold">
                      🌐 {t.language}
                    </span>

                    <span className="text-xs text-slate-400">
                      {language === "pt"
                        ? "🇧🇷 Português"
                        : language === "en"
                        ? "🇺🇸 English"
                        : "🇪🇸 Español"}
                    </span>
                  </button>

                  {languageOpen && (
                    <div className="mt-3 grid gap-2">

                      <button
                        type="button"
                        onClick={() => changeLanguage("pt")}
                        className={`rounded-lg px-3 py-2 text-left text-xs transition ${
                          language === "pt"
                            ? "bg-blue-600 text-white"
                            : "bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
                        }`}
                      >
                        🇧🇷 Português
                      </button>

                      <button
                        type="button"
                        onClick={() => changeLanguage("en")}
                        className={`rounded-lg px-3 py-2 text-left text-xs transition ${
                          language === "en"
                            ? "bg-blue-600 text-white"
                            : "bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
                        }`}
                      >
                        🇺🇸 English
                      </button>

                      <button
                        type="button"
                        onClick={() => changeLanguage("es")}
                        className={`rounded-lg px-3 py-2 text-left text-xs transition ${
                          language === "es"
                            ? "bg-blue-600 text-white"
                            : "bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
                        }`}
                      >
                        🇪🇸 Español
                      </button>

                    </div>
                  )}

                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-left text-sm text-red-400 transition hover:bg-red-500/20"
                >
                  🚪 {t.logout}
                </button>

              </div>

            </div>
          </div>
        )}
      </header>

      {/* CONTEÚDO */}
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">

        <div className="text-center">

          <div className="mb-4 inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-400 sm:px-4 sm:py-2 sm:text-sm">
            {t.todayAnalysis}
          </div>

          <h2 className="text-3xl font-bold sm:text-5xl">
            {t.chooseMarket}
          </h2>

          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-400 sm:mt-4 sm:text-base">
            {t.chooseMarketDescription}
          </p>

        </div>

        {/* MERCADOS */}
        <div className="mt-7 grid grid-cols-2 gap-3 sm:mt-10 sm:grid-cols-2 sm:gap-4 lg:grid-cols-5">

          {markets.map((market) => (

            <button
              key={market.name}
              type="button"
              onClick={() => setSelectedMarket(market.name)}
              className={`rounded-2xl border p-4 text-left transition sm:p-5 ${
                selectedMarket === market.name
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-white/10 bg-white/[0.03] hover:border-blue-500/40"
              }`}
            >

              <div className="text-2xl sm:text-3xl">
                {market.icon}
              </div>

              <h3 className="mt-3 text-sm font-semibold sm:mt-4 sm:text-base">
                {market.name}
              </h3>

              <p className="mt-1 text-[11px] leading-4 text-slate-400 sm:text-xs sm:leading-5">
                {market.description}
              </p>

            </button>

          ))}

        </div>

        {/* OPORTUNIDADES */}
        <div className="mt-8 sm:mt-10">

          <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">

            <div className="min-w-0">

              <h3 className="text-xl font-bold sm:text-2xl">
                {t.opportunities} — {selectedMarket}
              </h3>

              <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                {t.prepared}
              </p>

            </div>

            <div className="w-fit rounded-full bg-blue-500/10 px-3 py-1.5 text-xs text-blue-400 sm:px-4 sm:py-2 sm:text-sm">

              {marketOpportunities.length}{" "}

              {marketOpportunities.length === 1
                ? t.opportunity
                : t.opportunitiesPlural}

            </div>

          </div>

          {/* LOADING */}
          {loading && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center sm:p-10">

              <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-white/10 border-t-blue-500 sm:h-10 sm:w-10" />

              <p className="mt-4 text-sm text-slate-400">
                {t.loadingOpportunities}
              </p>

            </div>
          )}

          {/* ERRO */}
          {!loading && error && (
            <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-5 text-center text-sm text-red-400 sm:p-6">
              {error}
            </div>
          )}

          {/* SEM OPORTUNIDADES */}
          {!loading &&
            !error &&
            marketOpportunities.length === 0 && (

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center sm:p-10">

                <div className="text-3xl sm:text-4xl">
                  📭
                </div>

                <h3 className="mt-4 text-lg font-bold sm:text-xl">
                  {t.noOpportunity}
                </h3>

                <p className="mt-2 text-sm text-slate-400">
                  {t.noOpportunityDescription}{" "}
                  {selectedMarket}.
                </p>

              </div>
            )}

          {/* CARDS */}
          {!loading &&
            !error &&
            marketOpportunities.length > 0 && (

              <div className="grid gap-4 sm:gap-5">

                {marketOpportunities.map((opportunity) => {

                  const unlocked = hasAccess(opportunity.id);

                  return (
                    <div
                      key={opportunity.id}
                      className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-6"
                    >

                      {/* CABEÇALHO */}
                      <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">

                        <div className="min-w-0">

                          <p className="text-[11px] uppercase tracking-wider text-slate-500 sm:text-xs">
                            {t.asset}
                          </p>

                          <h4 className="mt-1 break-words text-xl font-bold sm:text-2xl">
                            {opportunity.asset}
                          </h4>

                        </div>

                        <div
                          className={`rounded-full px-3 py-1.5 text-xs font-bold sm:px-4 sm:py-2 sm:text-sm ${
                            opportunity.direction === "LONG"
                              ? "bg-green-500/10 text-green-400"
                              : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          {opportunity.direction}
                        </div>

                      </div>

                      {/* INFORMAÇÕES */}
                      <div className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-3">

                        <div className="rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4">

                          <p className="text-xs text-slate-500">
                            {t.risk}
                          </p>

                          <p className="mt-1 text-sm font-semibold sm:text-base">
                            {opportunity.risk}
                          </p>

                        </div>

                        <div className="rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4">

                          <p className="text-xs text-slate-500">
                            {t.market}
                          </p>

                          <p className="mt-1 text-sm font-semibold sm:text-base">
                            {opportunity.market}
                          </p>

                        </div>

                        <div className="rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4">

                          <p className="text-xs text-slate-500">
                            {t.status}
                          </p>

                          <p
                            className={`mt-1 text-sm font-semibold sm:text-base ${
                              unlocked
                                ? "text-green-400"
                                : "text-yellow-400"
                            }`}
                          >
                            {checkingAccess
                              ? t.checking
                              : unlocked
                              ? `✅ ${t.unlocked}`
                              : `🔒 ${t.locked}`}
                          </p>

                        </div>

                      </div>

                      {/* SINAL DESBLOQUEADO */}
                      {unlocked ? (

                        <div className="mt-5 rounded-2xl border border-green-500/20 bg-green-500/5 p-4 sm:mt-6 sm:p-6">

                          <div className="mb-4 flex items-center gap-2 sm:mb-5">

                            <span className="text-xl sm:text-2xl">
                              🔓
                            </span>

                            <div>

                              <p className="text-sm font-semibold text-green-400 sm:text-base">
                                {t.unlockedAnalysis}
                              </p>

                              <p className="text-[11px] text-slate-400 sm:text-xs">
                                {t.accessSignal}
                              </p>

                            </div>

                          </div>

                          <div className="grid gap-3 sm:gap-4 sm:grid-cols-3">

                            <div>
                              <p className="text-xs text-slate-500">
                                {t.entry}
                              </p>

                              <p className="mt-1 text-sm font-semibold sm:text-base">
                                {opportunity.entry}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-slate-500">
                                {t.stopLoss}
                              </p>

                              <p className="mt-1 text-sm font-semibold sm:text-base">
                                {opportunity.stopLoss}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-slate-500">
                                {t.takeProfit}
                              </p>

                              <p className="mt-1 text-sm font-semibold sm:text-base">
                                {opportunity.takeProfit}
                              </p>
                            </div>

                          </div>

                          <div className="mt-5 sm:mt-6">

                            <p className="text-sm font-semibold">
                              {t.analysis}
                            </p>

                            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-300 sm:leading-7">
                              {opportunity.analysis}
                            </p>

                          </div>

                        </div>

                      ) : (

                        /* SINAL BLOQUEADO */
                        <div className="relative mt-5 overflow-hidden rounded-2xl border border-yellow-500/20 bg-yellow-500/5 sm:mt-6">

                          <div className="select-none p-4 blur-sm sm:p-6">

                            <p className="text-sm font-semibold">
                              {t.entry}
                            </p>

                            <p className="mt-1 text-sm sm:text-base">
                              {opportunity.entry}
                            </p>

                            <p className="mt-4 text-sm font-semibold">
                              {t.stopLoss}
                            </p>

                            <p className="mt-1 text-sm sm:text-base">
                              {opportunity.stopLoss}
                            </p>

                            <p className="mt-4 text-sm font-semibold">
                              {t.takeProfit}
                            </p>

                            <p className="mt-1 text-sm sm:text-base">
                              {opportunity.takeProfit}
                            </p>

                            <p className="mt-4 text-sm font-semibold">
                              {t.analysis}
                            </p>

                            <p className="mt-1 text-sm sm:text-base">
                              {opportunity.analysis}
                            </p>

                          </div>

                          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 px-4">

                            <div className="max-w-sm text-center">

                              <div className="text-2xl sm:text-3xl">
                                🔒
                              </div>

                              <p className="mt-2 text-sm font-semibold sm:text-base">
                                {t.lockedAnalysis}
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                {t.paymentToUnlock}
                              </p>

                              <button
                                type="button"
                                onClick={() =>
                                  handleUnlock(opportunity)
                                }
                                className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold transition hover:bg-blue-500 sm:px-6 sm:py-3 sm:text-sm"
                              >
                                💳 {t.unlock}
                              </button>

                            </div>

                          </div>

                        </div>
                      )}

                    </div>
                  );
                })}

              </div>
            )}

        </div>

      </section>

      {/* ========================================================= */}
      {/* MODAL DE DEPÓSITO                                        */}
      {/* ========================================================= */}

      {depositOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm">

          <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/10 bg-slate-950 shadow-2xl">

            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-slate-950 px-5 py-4 sm:px-6">

              <div>
                <h2 className="text-lg font-bold sm:text-xl">
                  {t.depositTitle}
                </h2>

                <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                  {t.depositDescription}
                </p>
              </div>

              <button
                type="button"
                onClick={closeDeposit}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                ×
              </button>

            </div>

            <div className="p-5 sm:p-6">

              {/* PASSO 1 */}
              <div>

                <p className="text-sm font-semibold">
                  {t.selectAmount}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">

                  {depositAmounts.map((amount) => {

                    const selected = depositAmount === amount;

                    return (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setDepositAmount(amount)}
                        className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                          selected
                            ? "border-blue-500 bg-blue-500/10 text-blue-400"
                            : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-blue-500/40 hover:bg-white/[0.05]"
                        }`}
                      >
                        ${amount.toLocaleString("en-US")}
                      </button>
                    );
                  })}

                </div>

                <div className="mt-4">

                  <label className="mb-2 block text-xs text-slate-400">
                    {t.customAmount}
                  </label>

                  <input
                    type="number"
                    min={100}
                    max={20000}
                    value={depositAmount ?? ""}
                    onChange={(event) => {
                      const value = Number(event.target.value);

                      if (!value) {
                        setDepositAmount(null);
                        return;
                      }

                      if (value < 100) {
                        setDepositAmount(100);
                        return;
                      }

                      if (value > 20000) {
                        setDepositAmount(20000);
                        return;
                      }

                      setDepositAmount(value);
                    }}
                    placeholder={t.amountPlaceholder}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500"
                  />

                </div>

              </div>

              {/* PASSO 2 */}
              {depositAmount && (
                <div className="mt-7 border-t border-white/10 pt-6">

                  <p className="text-sm font-semibold">
                    {t.selectMethod}
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">

                    <button
                      type="button"
                      onClick={() => setDepositMethod("CARD")}
                      className={`rounded-2xl border p-4 text-left transition ${
                        depositMethod === "CARD"
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-white/10 bg-white/[0.03] hover:border-blue-500/40"
                      }`}
                    >

                      <div className="text-2xl">
                        💳
                      </div>

                      <p className="mt-2 text-sm font-semibold">
                        {t.card}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {t.cardDescription}
                      </p>

                    </button>

                    <button
                      type="button"
                      onClick={() => setDepositMethod("CRYPTO")}
                      className={`rounded-2xl border p-4 text-left transition ${
                        depositMethod === "CRYPTO"
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-white/10 bg-white/[0.03] hover:border-blue-500/40"
                      }`}
                    >

                      <div className="text-2xl">
                        ₮
                      </div>

                      <p className="mt-2 text-sm font-semibold">
                        {t.crypto}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {t.cryptoDescription}
                      </p>

                    </button>

                  </div>

                </div>
              )}

              {/* CARTÃO */}
              {depositAmount && depositMethod === "CARD" && (
                <form
                  onSubmit={handleCardDeposit}
                  className="mt-7 border-t border-white/10 pt-6"
                >

                  <div className="mb-4">

                    <p className="text-sm font-semibold">
                      {t.cardPayment}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {t.selectedAmount}{" "}
                      <span className="font-semibold text-white">
                        ${depositAmount.toLocaleString("en-US")}
                      </span>
                    </p>

                  </div>

                  <div className="space-y-4">

                    <div>
                      <label className="mb-2 block text-xs text-slate-400">
                        {t.cardNumber}
                      </label>

                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="cc-number"
                        value={cardNumber}
                        onChange={(event) =>
                          setCardNumber(event.target.value)
                        }
                        placeholder="0000 0000 0000 0000"
                        className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs text-slate-400">
                        {t.cardName}
                      </label>

                      <input
                        type="text"
                        autoComplete="cc-name"
                        value={cardName}
                        onChange={(event) =>
                          setCardName(event.target.value)
                        }
                        placeholder={t.fullName}
                        className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">

                      <div>
                        <label className="mb-2 block text-xs text-slate-400">
                          {t.expiry}
                        </label>

                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="cc-exp"
                          value={cardExpiry}
                          onChange={(event) =>
                            setCardExpiry(event.target.value)
                          }
                          placeholder="MM/AA"
                          className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-xs text-slate-400">
                          {t.cvv}
                        </label>

                        <input
                          type="password"
                          inputMode="numeric"
                          autoComplete="cc-csc"
                          value={cardCvv}
                          onChange={(event) =>
                            setCardCvv(event.target.value)
                          }
                          placeholder="123"
                          maxLength={4}
                          className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500"
                          required
                        />
                      </div>

                    </div>

                    <button
                      type="submit"
                      className="w-full rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-500"
                    >
                      💳 {t.continuePayment}
                    </button>

                  </div>

                </form>
              )}

              {/* CRYPTO */}
              {depositAmount && depositMethod === "CRYPTO" && (
                <div className="mt-7 border-t border-white/10 pt-6">

                  <div className="mb-5">

                    <p className="text-sm font-semibold">
                      {t.cryptoDeposit}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {t.cryptoDescriptionFull}
                    </p>

                  </div>

                  <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4">

                    <p className="text-xs font-semibold text-yellow-400">
                      ⚠️ {t.requiredNetwork}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      {t.networkWarning}
                    </p>

                  </div>

                  <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">

                    <p className="text-xs text-slate-500">
                      {t.depositValue}
                    </p>

                    <p className="mt-1 text-xl font-bold">
                      ${depositAmount.toLocaleString("en-US")} USDT
                    </p>

                  </div>

                  <div className="mt-4">

                    <p className="mb-2 text-xs text-slate-400">
                      {t.usdtAddress}
                    </p>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">

                      <p className="break-all text-sm leading-6 text-slate-200">
                        {USDT_TRC20_ADDRESS}
                      </p>

                      <button
                        type="button"
                        onClick={copyCryptoAddress}
                        disabled={!USDT_TRC20_ADDRESS}
                        className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {copiedAddress
                          ? `✅ ${t.addressCopied}`
                          : `📋 ${t.copyAddress}`}
                      </button>

                    </div>

                  </div>

                  <div className="mt-5 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">

                    <p className="text-sm font-semibold text-blue-400">
                      {t.howToDeposit}
                    </p>

                    <p className="mt-2 text-xs leading-6 text-slate-400">
                      1. {t.step1}
                      <br />
                      2. {t.step2}
                      <br />
                      3. {t.step3}
                      <br />
                      4. {t.step4}
                      <br />
                      5. {t.step5}
                    </p>

                  </div>

                </div>
              )}

            </div>

          </div>

        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL DE APOIO AO CLIENTE                                */}
      {/* ========================================================= */}

      {supportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm">

          <div className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl">

            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">

              <div>
                <h2 className="text-lg font-bold sm:text-xl">
                  💬 {t.supportTitle}
                </h2>

                <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                  {t.supportDescription}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSupportOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                ×
              </button>

            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-5 sm:p-6">

              {supportMessages.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-400">
                  {t.supportDescription}
                </div>
              )}

              {supportMessages.map((message) => (

                <div
                  key={message.id}
                  className={`flex ${
                    message.senderType === "user"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >

                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                      message.senderType === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-white/[0.06] text-slate-200"
                    }`}
                  >
                    {message.message}
                  </div>

                </div>

              ))}

            </div>

            <div className="border-t border-white/10 p-4 sm:p-5">

              <div className="flex gap-2">

                <input
                  type="text"
                  value={supportMessage}
                  onChange={(event) =>
                    setSupportMessage(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();
                      sendSupportMessage();
                    }
                  }}
                  placeholder={t.writeMessage}
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500"
                />

                <button
                  type="button"
                  onClick={sendSupportMessage}
                  disabled={sendingSupport}
                  className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
                >
                  {sendingSupport ? "..." : t.send}
                </button>

              </div>

            </div>

          </div>

        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL DE SAQUE                                           */}
      {/* ========================================================= */}

      {withdrawOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm">

          <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/10 bg-slate-950 shadow-2xl">

            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">

              <div>
                <h2 className="text-lg font-bold sm:text-xl">
                  💰 {t.withdrawTitle}
                </h2>

                <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                  {t.withdrawDescription}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setWithdrawOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                ×
              </button>

            </div>

            <div className="space-y-4 p-5 sm:p-6">

              <div>
                <label className="mb-2 block text-xs text-slate-400">
                  {t.name}
                </label>

                <input
                  type="text"
                  value={withdrawName}
                  onChange={(event) =>
                    setWithdrawName(event.target.value)
                  }
                  placeholder={t.fullName}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs text-slate-400">
                  {t.iban}
                </label>

                <input
                  type="text"
                  value={withdrawIban}
                  onChange={(event) =>
                    setWithdrawIban(event.target.value)
                  }
                  placeholder="IBAN"
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs text-slate-400">
                  {t.accountNumber}
                </label>

                <input
                  type="text"
                  value={withdrawAccountNumber}
                  onChange={(event) =>
                    setWithdrawAccountNumber(event.target.value)
                  }
                  placeholder={t.accountNumber}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs text-slate-400">
                  {t.bank}
                </label>

                <input
                  type="text"
                  value={withdrawBank}
                  onChange={(event) =>
                    setWithdrawBank(event.target.value)
                  }
                  placeholder={t.bank}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500"
                />
              </div>

              {withdrawSaved && (
                <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-400">
                  ✅ {t.saved}
                </div>
              )}

              <button
                type="button"
                onClick={saveWithdrawData}
                disabled={savingWithdraw}
                className="w-full rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
              >
                {savingWithdraw
                  ? "..."
                  : `💾 ${t.saveBankData}`}
              </button>

            </div>

          </div>

        </div>
      )}

    </main>
  );
}
