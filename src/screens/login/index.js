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
import { useEffect, useState } from "react";
import { appContext } from "@/src/context";

const image = require("../../../assets/login.jpg"); // Caminho relativo para sua imagem

export default function LoginScreen() {
  const navigation = useNavigation();
  const { setServerPhotoPath, matricula, setMatricula, arquivos, setArquivos } =
    appContext();

  /**
   * Lista todos os arquivos de imagens disponíveis no servidor
   * @function listServerImages
   * @returns {Promise<{success: boolean, message: string, files: string[]}>} Objeto com status, mensagem e array de nomes de arquivos
   *
   * @example
   * // Exemplo de uso:
   * listServerImages()
   *   .then(data => console.log('Arquivos:', data.files))
   *   .catch(error => console.error('Erro:', error));
   */
  const listServerImages = async () => {
    const url =
      "https://comlurbdev.rio.rj.gov.br/extranet/Fotos/fotoRecoginizer/list.php";

    return RNFetchBlob.fetch("GET", url)
      .then((response) => {
        if (response.respInfo.status === 200) {
          const jsonData = JSON.parse(response.data);
          const { files } = jsonData;
          setArquivos(files);
        }
      })
      .catch((error) => {
        console.error("Erro ao listar imagens:", error);
      });
  };

  /**
   * Realiza o download de uma imagem do servidor da Comlurb baseado no número de matrícula
   * @async
   * @function downloadImage
   * @returns {Promise<void>} Promise que não retorna valor explícito, mas atualiza o estado da aplicação
   * @throws {Error} Lança erro caso o download falhe e navega para a tela de erro
   *
   * @description
   * Esta função:
   * 1. Formata o número de matrícula conforme regras específicas
   * 2. Constrói a URL para download da imagem
   * 3. Baixa a imagem usando RNFetchBlob
   * 4. Navega para diferentes telas baseado no resultado:
   *    - Tela 'Luz' se não encontrar imagem
   *    - Tela 'Saved' se download for bem-sucedido
   *    - Tela 'ErrorPhoto' se ocorrer erro
   *
   * @example
   * // Exemplo de uso:
   * await downloadImage();
   * // O resultado é tratado via navegação e estados da aplicação
   */
  const downloadImage = async () => {
    console.log("matricula", matricula);

    if (!matricula) {
      return;
    }

    if (!arquivos.length) {
      navigation.navigate("Camera");
    }

    const _files = arquivos.map((x) => x.substring(0, 8));
    let _includes = _files.includes(matricula);
    let _matricula;
    console.log(_files);

    const filter = arquivos.filter((x) => x.substring(0, 8) === matricula)[0];
    _matricula = filter;
    console.log("_matricula", _matricula, _includes);

    if (!_includes) {
      navigation.navigate("Luz");
      return;
    } else {
      setMatricula(filter);
    }

    const imageUrl = `https://comlurbdev.rio.rj.gov.br/extranet/Fotos/fotoRecoginizer/downlaod.php?file=${_matricula}`;

    console.log(imageUrl);

    try {
      const res = await RNFetchBlob.config({
        fileCache: true, // Cacheia o arquivo localmente
        appendExt: "jpg", // Adiciona a extensão .jpg ao arquivo
      }).fetch("GET", imageUrl);

      // O caminho local do arquivo baixado
      const imagePath = res.path();
      setServerPhotoPath(imagePath);
      console.log("chegou aqui");
      navigation.navigate("Saved");
    } catch (error) {
      navigation.navigate("ErrorPhoto");
    }
  };

  useEffect(() => {
    listServerImages();
  }, []);

  return (
    <GluestackUIProvider mode='light'>
      <Box className='flex-1'>
        {/* ImageBackground sobrepondo a câmera com um z-index maior */}
        <ImageBackground
          style={{
            position: "absolute",
            left: 0, // Margem esquerda
            right: 0, // Margem direita
            top: 0, // Margem superior maior
            bottom: 0, // Margem inferior menor
          }}
          source={image}
          resizeMode='cover'
          className='absolute inset-0 z-10' // z-10 para sobrepor
        />
        {/* O Box principal agora usa flexbox para centralizar seu conteúdo */}
        <Box className='flex-1 items-center justify-center z-20'>
          {/* Este Box será o conteúdo centralizado (seu formulário/botão) */}
          <Box className='w-full p-4' style={{ maxWidth: 400 }}>
            <VStack space='md'>
              <Text className='text-blue-950 text-3xl font-bold text-center'>
                Matrícula
              </Text>
              <Input
                className='bg-white opacity-35'
                isDisabled={false}
                isInvalid={false}
                isReadOnly={false}
              >
                <InputField
                  placeholder='Entre com sua matrícula...'
                  className='text-black font-bold text-xl'
                  keyboardType={"numeric"}
                  onChangeText={(value) => {
                    console.log(value);
                    setMatricula(value);
                  }}
                />
              </Input>
              <Button
                className='w-72 h-16 rounded-full bg-blue-100 self-center' // self-center para centralizar o botão dentro do VStack
                onPress={async () => await downloadImage()}
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
