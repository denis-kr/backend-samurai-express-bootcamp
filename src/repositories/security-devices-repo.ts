import { injectable } from "inversify";
import { SecurityDeviceModel } from "./models/security-device-model.js";

@injectable()
export class SecurityDevicesRepository {
  async deleteAll() {
    await SecurityDeviceModel.deleteMany({});
  }
}
