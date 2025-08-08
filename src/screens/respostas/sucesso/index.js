//#region IMPORTS
import "react-native-reanimated"; // Mantido para consistência com seu modelo
import "@/global.css"; // Mantido para consistência com seu modelo
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useNavigation } from "@react-navigation/native";
import { Button, ButtonText } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import { appContext } from "@/src/context";
import { useEffect } from "react";
import RNFetchBlob from "rn-fetch-blob";

//#endregion

export default function SucessoScreen() {
  //#region ESTADOS

  const navigation = useNavigation();
  const { serverPhotoPath, setServerPhotoPath, matriculFormatada } =
    appContext();

  //#endregion

  //#region FUNÇÕES PRINCIPAIS
  /**
   * Envia uma requisição POST para apagar uma imagem no servidor PHP.
   * @param {string} imageName - O nome completo do arquivo da imagem a ser apagada (ex: "minha_foto.jpg").
   * @returns {Promise<Object>} - Uma promessa que resolve com a resposta JSON do servidor ou rejeita com um erro.
   */
  const deleteImage = async () => {
    // Substitua pela URL real do seu script PHP de exclusão.
    // Ex: 'http://seu_ip_do_servidor/Extranet/Fotos/fotoRecoginizer/delete_image.php'
    const SERVER_URL =
      "https://comlurbdev.rio.rj.gov.br/extranet/Fotos/fotoRecoginizer/delete.php";

    // Validação básica do nome da imagem

    console.log("matriculFormatada", matriculFormatada);

    try {
      const response = await RNFetchBlob.fetch(
        "POST", // Método da requisição
        SERVER_URL, // URL do script PHP
        {
          // Headers da requisição (Content-Type é importante para 'x-www-form-urlencoded')
          "Content-Type": "application/x-www-form-urlencoded",
        },
        // Corpo da requisição: os dados devem ser formatados como 'chave=valor'
        // URLSearchParams ajuda a garantir a formatação correta para x-www-form-urlencoded
        `image_name=${encodeURIComponent(matriculFormatada + ".jpg")}`
      );

      // Converte a resposta para texto (JSON string)
      const responseText = response.data;

      // Tenta fazer o parse do JSON
      const responseJson = JSON.parse(responseText);

      // Verifica o status HTTP da resposta
      if (response.respInfo.status >= 200 && response.respInfo.status < 300) {
        // Requisição bem-sucedida (status 2xx)
        console.log("Imagem apagada com sucesso:", responseJson);
        navigation.navigate("Luz");
        return responseJson;
      } else {
        // Requisição com erro (status 4xx ou 5xx)
        console.error("Erro ao apagar imagem:", responseJson);
        throw new Error(
          responseJson.message || "Erro desconhecido ao apagar imagem."
        );
      }
    } catch (error) {
      console.error("Erro na requisição deleteImage:", error);
      // Relança o erro para que a função que chamou possa tratá-lo
      throw error;
    }
  };

  const handleOK = () => {
    setServerPhotoPath(null);
    navigation.navigate("Login");
  };

  //#endregion

  return (
    <GluestackUIProvider mode='light'>
      {/* VStack para centralizar o conteúdo verticalmente e horizontalmente */}
      <VStack className='flex-1 justify-center items-center p-5'>
        <Text
          // Usando classes NativeWind para estilizar o texto
          // text-green-500 para a cor verde (você pode ajustar a tonalidade)
          // text-2xl para o tamanho da fonte (ajuste conforme preferência)
          // font-bold para negrito
          // mb-2 para uma pequena margem inferior entre as duas linhas
          className='text-green-500 text-2xl font-bold mb-2 text-center'
        >
          SUCESSO
        </Text>
        <Text
          // Estilizando a segunda linha
          className='text-green-500 text-xl text-center'
        >
          Foto salva com sucesso.
        </Text>

        <Image
          // Classes NativeWind para ocupar 100% da largura e altura do seu contêiner pai (o Box)
          className='w-60 h-96'
          source={{
            uri: `file://${serverPhotoPath}`, // Mantido o prefixo 'file://' conforme discutido
          }}
          alt='Imagem capturada' // Melhor descrição para alt
          resizeMode='contain' // Ou 'cover', dependendo de como você quer que a imagem se ajuste
        />

        <Button
          className='h-32 w-32 bg-red-800 rounded-full mt-6'
          onPress={() => {
            deleteImage();
          }}
        >
          <ButtonText className='text-2xl'>Apagar</ButtonText>
        </Button>

        <Button
          className='h-32 w-32 bg-green-800 rounded-full mt-6'
          onPress={handleOK}
        >
          <ButtonText className='text-2xl'>Aceitar</ButtonText>
        </Button>
      </VStack>
    </GluestackUIProvider>
  );
}
