<?php
/**
 * Reports index.
 *
 * @var array<string,array{title:string,headers:string[]}> $reports
 */
$icons = ['customers' => 'people', 'products' => 'box', 'licenses' => 'key', 'renewals' => 'bell', 'expired' => 'key', 'activations' => 'cpu', 'revenue' => 'chart'];
?>
<div class="row g-4">
    <?php foreach ($reports as $type => $meta): ?>
        <div class="col-md-4 col-sm-6">
            <a href="<?= url('reports/' . $type) ?>" class="text-decoration-none">
                <div class="card h-100">
                    <div class="card-body d-flex align-items-center gap-3">
                        <div class="stat-icon stat-primary" style="width:48px;height:48px;background:linear-gradient(135deg,#1a3a5c,#2471a3)"><?= icon($icons[$type] ?? 'chart') ?></div>
                        <div>
                            <h6 class="mb-1 text-body"><?= e($meta['title']) ?></h6>
                            <small class="text-muted">View &amp; export</small>
                        </div>
                    </div>
                </div>
            </a>
        </div>
    <?php endforeach; ?>
</div>
