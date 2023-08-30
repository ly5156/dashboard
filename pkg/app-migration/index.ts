import { importTypes } from '@rancher/auto-import';
import { IPlugin } from '@shell/core/types';
import appMigreationRoutes from './routes/app-migration-routes';

// Init the package
export default function(plugin: IPlugin): void {
  // Auto-import model, detail, edit from the folders
  importTypes(plugin);

  // Provide plugin metadata from package.json
  plugin.metadata = require('./package.json');

  // Load a product
  plugin.addProduct(require('./config/product'));

  // Routes
  plugin.addRoutes(appMigreationRoutes);
}
