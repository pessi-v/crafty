<?php

namespace modules\recipesmodule;

use Craft;
use yii\base\Module as BaseModule;

class Module extends BaseModule
{
    public function init()
    {
        parent::init();

        // Set the controllerNamespace based on whether this is a console or web request
        if (Craft::$app->getRequest()->getIsConsoleRequest()) {
            $this->controllerNamespace = 'modules\\recipesmodule\\console\\controllers';
        } else {
            $this->controllerNamespace = 'modules\\recipesmodule\\controllers';
        }

        Craft::setAlias('@modules/recipesmodule', $this->getBasePath());

        // Log that the module has been loaded
        Craft::info(
            'Recipes module loaded',
            __METHOD__
        );
    }
}
