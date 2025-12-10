<?php

namespace modules\recipesmodule\controllers;

use Craft;
use craft\helpers\App;
use craft\web\Controller;
use craft\elements\Entry;
use craft\elements\Asset;
use craft\helpers\Assets;
use yii\web\Response;
use yii\web\BadRequestHttpException;
use yii\web\UploadedFile;

class RecipesController extends Controller
{
    protected array|bool|int $allowAnonymous = ['submit'];
    public $enableCsrfValidation = false;

    public function actionSubmit(): Response
    {
        $this->requirePostRequest();

        // Get the password from environment variable
        $correctPassword = App::env('RECIPE_SUBMIT_PASSWORD');

        // Validate password
        $submittedPassword = Craft::$app->request->getBodyParam('salasana');
        if ($submittedPassword !== $correctPassword) {
            if (Craft::$app->request->getAcceptsJson()) {
                return $this->asJson([
                    'success' => false,
                    'error' => 'Invalid password'
                ]);
            }
            Craft::$app->session->setError('Invalid password');
            return $this->redirect(Craft::$app->request->getReferrer());
        }

        // Get form data
        $title = Craft::$app->request->getBodyParam('title');
        $categories = Craft::$app->request->getBodyParam('categories', []);
        $contentBlocks = Craft::$app->request->getBodyParam('contentBlocks', []);

        // Validate required fields
        if (empty($title)) {
            if (Craft::$app->request->getAcceptsJson()) {
                return $this->asJson([
                    'success' => false,
                    'error' => 'Title is required'
                ]);
            }
            Craft::$app->session->setError('Title is required');
            return $this->redirect(Craft::$app->request->getReferrer());
        }

        // Get the Recipe section
        $section = Craft::$app->getEntries()->getSectionByHandle('recipes');
        if (!$section) {
            throw new BadRequestHttpException('Recipe section not found');
        }

        // Get the entry type
        $entryTypes = $section->getEntryTypes();
        if (empty($entryTypes)) {
            throw new BadRequestHttpException('No entry type found for Recipe section');
        }
        $entryType = $entryTypes[0];

        // Create new entry
        $entry = new Entry([
            'sectionId' => $section->id,
            'typeId' => $entryType->id,
            'title' => $title,
            'enabled' => false, // Set to false so admin can review before publishing
        ]);

        // Set categories if provided
        if (!empty($categories)) {
            $entry->setFieldValue('recipeCategories', $categories);
        }

        // Process content blocks (Matrix field)
        if (!empty($contentBlocks)) {
            $matrixBlocks = [];

            foreach ($contentBlocks as $index => $block) {
                $blockType = $block['type'] ?? null;

                if ($blockType === 'text') {
                    $matrixBlocks['new' . ($index + 1)] = [
                        'type' => 'text',
                        'fields' => [
                            'text' => $block['text'] ?? ''
                        ]
                    ];
                } elseif ($blockType === 'image') {
                    // Handle image upload
                    $uploadedFile = UploadedFile::getInstanceByName("contentBlocks[$index][image]");

                    if ($uploadedFile) {
                        // Get or create the uploads folder (assuming volume handle is 'uploads')
                        $volume = Craft::$app->getAssets()->getVolumeByHandle('uploads');
                        if ($volume) {
                            $folderId = $volume->id;

                            // Create asset
                            $asset = new Asset();
                            $asset->tempFilePath = $uploadedFile->tempName;
                            $asset->filename = Assets::prepareAssetName($uploadedFile->name);
                            $asset->newFolderId = $folderId;
                            $asset->volumeId = $volume->id;
                            $asset->avoidFilenameConflicts = true;
                            $asset->setScenario(Asset::SCENARIO_CREATE);

                            if (Craft::$app->elements->saveElement($asset)) {
                                $matrixBlocks['new' . ($index + 1)] = [
                                    'type' => 'image',
                                    'fields' => [
                                        'image' => [$asset->id]
                                    ]
                                ];
                            }
                        }
                    }
                }
            }

            $entry->setFieldValue('recipeContent', $matrixBlocks);
        }

        // Save the entry
        if (Craft::$app->elements->saveElement($entry)) {
            if (Craft::$app->request->getAcceptsJson()) {
                return $this->asJson([
                    'success' => true,
                    'message' => 'Recipe submitted successfully! It will be reviewed before publishing.',
                    'entry' => [
                        'id' => $entry->id,
                        'title' => $entry->title,
                        'url' => $entry->url
                    ]
                ]);
            }
            Craft::$app->session->setNotice('Recipe submitted successfully! It will be reviewed before publishing.');
            return $this->redirect('/recipes/submit');
        }

        // Handle errors
        $errors = $entry->getErrors();
        if (Craft::$app->request->getAcceptsJson()) {
            return $this->asJson([
                'success' => false,
                'error' => 'Failed to save recipe',
                'errors' => $errors
            ]);
        }

        Craft::$app->session->setError('Failed to save recipe: ' . implode(', ', array_map(function($err) {
            return implode(', ', $err);
        }, $errors)));

        return $this->redirect(Craft::$app->request->getReferrer());
    }
}
