import "@/global.css";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { ImageBackground } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Button, ButtonText } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";
import { useNavigation } from "@react-navigation/native";
import RNFetchBlob from "rn-fetch-blob";
import { useEffect } from "react";
import { appContext } from "@/src/context";

const image = require("../../../assets/login.jpg"); // Caminho relativo da imagem

/**
 * Retorna a primeira palavra da lista que contém a parte informada.
 *
 * @param {string[]} lista - Lista de palavras para buscar.
 * @param {string} parte - Parte da palavra a ser procurada.
 * @returns {string|null} A palavra correspondente ou null se nenhuma for encontrada.
 */
function encontrarPalavraPorParte(lista, parte) {
  if (!Array.isArray(lista) || typeof parte !== "string") return null;
  return lista.find((palavra) => palavra.includes(parte)) || null;
}

export default function LoginScreen() {
  const navigation = useNavigation();
  const {
    setServerPhotoPath,
    matricula,
    setMatricula,
    arquivos,
    setArquivos,
    resetaTudo,
  } = appContext();

  /**
   * Lista todos os arquivos de imagens disponíveis no servidor
   */
  const listServerImages = async () => {
    const url =
      "https://comlurbdev.rio.rj.gov.br/extranet/Fotos/fotoRecoginizer/list.php";

    try {
      const response = await RNFetchBlob.fetch("GET", url);
      if (response.respInfo.status === 200) {
        const { files } = JSON.parse(response.data);
        setArquivos(files);
      }
    } catch (error) {
      navigation.navigate("ErrorListar");
    }
  };

  /**
   * Realiza o download de uma imagem do servidor baseado na matrícula
   * @param {string} matricula - Matrícula do usuário
   */
  const downloadImage = async (matricula) => {
    if (!matricula) return;
    if (!arquivos.length) {
      navigation.navigate("Camera");
      return;
    }

    let _primerioCaracter = matricula.substring(0, 1);
    let _matricula = encontrarPalavraPorParte(arquivos, matricula);

    if (!_matricula) {
      navigation.navigate("Luz");
      return;
    }

    // Ajusta o prefixo da matrícula conforme regras do servidor
    if (matricula.length <= 6) _matricula = "014" + matricula.padStart(6, "0");
    else if (_primerioCaracter === "8")
      _matricula = "0" + matricula.padStart(6, "0");
    else _matricula = matricula.padStart(6, "0");

    setMatricula(_matricula);

    const imageUrl = `https://comlurbdev.rio.rj.gov.br/extranet/Fotos/fotoRecoginizer/downlaod.php?file=${_matricula}.jpg`;

    try {
      const res = await RNFetchBlob.config({
        fileCache: true,
        appendExt: "jpg",
      }).fetch("GET", imageUrl);

      setServerPhotoPath(res.path());
      navigation.navigate("Saved");
    } catch (error) {
      navigation.navigate("ErrorPhoto");
    }
  };

  // Resetar estados e listar imagens do servidor ao montar componente
  useEffect(() => {
    resetaTudo();
    listServerImages();
  }, []);

  return (
    <GluestackUIProvider mode='light'>
      <Box className='flex-1'>
        <ImageBackground
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
          source={image}
          resizeMode='cover'
          className='absolute inset-0 z-10'
        />
        <Box className='flex-1 items-center justify-center z-20'>
          <Box className='w-full p-4' style={{ maxWidth: 400 }}>
            <VStack space='md'>
              <Text className='text-blue-950 text-3xl font-bold text-center'>
                Matrícula
              </Text>
              <Input className='bg-white opacity-35'>
                <InputField
                  placeholder='Entre com sua matrícula...'
                  className='text-black font-bold text-xl'
                  keyboardType='numeric'
                  onChangeText={(value) => setMatricula(value)}
                />
              </Input>
              <Button
                className='w-72 h-16 rounded-full bg-blue-100 self-center'
                onPress={async () => await downloadImage(matricula)}
              >
                <ButtonText className='text-3xl text-blue-950'>
                  acessar
                </ButtonText>
              </Button>
            </VStack>
          </Box>
        </Box>
      </Box>
    </GluestackUIProvider>
  );
}
