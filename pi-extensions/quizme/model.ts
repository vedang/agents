import type { Model } from "@mariozechner/pi-ai";

export const QUIZME_MODEL = "cerebras/zai-glm-4.7"; // [tag:quizme_model_spec_format]

type QuizmeModelRegistry = {
  find: (provider: string, modelId: string) => Model<any> | undefined;
  getApiKey: (model: Model<any>) => Promise<string | undefined>;
};

type QuizmeModelInfo = {
  model: Model<any>;
  apiKey: string;
};

type ModelSpec = {
  provider: string;
  modelId: string;
};

const parseModelSpec = (spec: string): ModelSpec | undefined => {
  const [provider, ...rest] = spec.split("/"); // [ref:quizme_model_spec_format]
  if (!provider || rest.length === 0) {
    return undefined;
  }

  return { provider, modelId: rest.join("/") };
};

const resolveQuizmeModel = (
  modelRegistry: QuizmeModelRegistry,
): Model<any> | undefined => {
  const spec = parseModelSpec(QUIZME_MODEL);
  if (!spec) {
    return undefined;
  }

  return modelRegistry.find(spec.provider, spec.modelId);
};

export const getQuizmeModelInfo = async (
  modelRegistry: QuizmeModelRegistry,
  activeModel: Model<any> | undefined,
): Promise<QuizmeModelInfo | undefined> => {
  const quizModel = resolveQuizmeModel(modelRegistry);
  if (quizModel) {
    const quizApiKey = await modelRegistry.getApiKey(quizModel);
    if (quizApiKey) {
      return { model: quizModel, apiKey: quizApiKey };
    }
  }

  if (!activeModel) {
    return undefined;
  }

  const activeApiKey = await modelRegistry.getApiKey(activeModel);
  if (!activeApiKey) {
    return undefined;
  }

  return { model: activeModel, apiKey: activeApiKey };
};
