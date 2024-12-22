import configurationRepository from '../repositories/configurationRepository.js';

class ConfigurationService {
  async get(key) {
    const config = await configurationRepository.getByKey(key);
    return config ? config.value : null;
  }

  async set(key, value) {
    return await configurationRepository.set(key, value);
  }

  async getAll() {
    const configs = await configurationRepository.getAll();
    return configs.map((config) => ({ key: config.key, value: config.value }));
  }
}

export default new ConfigurationService();