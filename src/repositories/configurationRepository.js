import Configuration from '../models/Configuration.js';

class ConfigurationRepository {
  async getByKey(key) {
    return await Configuration.findOne({ where: { key } });
  }

  async set(key, value) {
    const [config, created] = await Configuration.upsert({ key, value });
    return config;
  }

  async getAll() {
    return await Configuration.findAll();
  }
}

export default new ConfigurationRepository();