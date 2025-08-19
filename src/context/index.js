// src/context/AppContext.js
import React, { createContext, useState, useContext } from "react";

/**
 * Contexto global da aplicação.
 * Fornece acesso a estados compartilhados como fotos, matrícula e arquivos.
 * @type {React.Context<Object>}
 */
const AppContext = createContext({});

/**
 * Componente Provedor do AppContext.
 * Envolve componentes que precisam acessar estados globais da aplicação.
 *
 * @param {Object} props - Propriedades do componente.
 * @param {React.ReactNode} props.children - Elementos filhos que terão acesso ao contexto.
 * @returns {JSX.Element} O provedor com os valores do contexto.
 */
export const AppProvider = ({ children }) => {
  /** Caminho local da foto tirada pela câmera */
  const [photoPath, setPhotoPath] = useState(null);

  /** Caminho da foto armazenada no servidor (ex.: passaporte) */
  const [serverPhotoPath, setServerPhotoPath] = useState(null);

  /** Matrícula do usuário */
  const [matricula, setMatricula] = useState(null);

  /** Matrícula formatada para exibição */
  const [matriculFormatada, setMatriculaFormatada] = useState(null);

  /** Lista de arquivos anexados pelo usuário */
  const [arquivos, setArquivos] = useState([]);

  /**
   * Reseta todos os estados do contexto para seus valores iniciais.
   * @returns {void}
   */
  const resetaTudo = () => {
    setPhotoPath(null);
    setServerPhotoPath(null);
    setMatricula(null);
    setMatriculaFormatada(null);
    setArquivos([]);
  };

  /** Valores e funções disponíveis no contexto */
  const AppContextValue = {
    photoPath,
    setPhotoPath,
    serverPhotoPath,
    setServerPhotoPath,
    matricula,
    setMatricula,
    arquivos,
    setArquivos,
    matriculFormatada,
    setMatriculaFormatada,
    resetaTudo,
  };

  return (
    <AppContext.Provider value={AppContextValue}>
      {children}
    </AppContext.Provider>
  );
};

/**
 * Hook personalizado para consumir o AppContext.
 * Facilita o acesso a estados globais dentro de componentes funcionais.
 *
 * @throws {Error} Lança erro se o hook for usado fora de um AppProvider.
 * @returns {Object} Objeto contendo estados e setters do contexto.
 */
export const appContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("appContext deve ser usado dentro de um AppProvider");
  }
  return context;
};
