<?php
/**
 * Plugin Name: Marqit Widget
 * Description: Adds the Marqit one-tap prediction widget to your articles. Paste your site key under Settings, Marqit.
 * Version: 1.0.0
 * Author: Grand Media Group LLC
 * Author URI: https://playmarqit.com
 * License: GPLv2 or later
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function marqit_widget_clean_key( $value ) {
	$value = trim( (string) $value );
	return preg_match( '/^[A-Za-z0-9_-]{4,40}$/', $value ) ? $value : '';
}

function marqit_widget_register_settings() {
	register_setting(
		'marqit_widget',
		'marqit_widget_key',
		array(
			'type'              => 'string',
			'sanitize_callback' => 'marqit_widget_clean_key',
			'default'           => '',
		)
	);
}
add_action( 'admin_init', 'marqit_widget_register_settings' );

function marqit_widget_menu() {
	add_options_page( 'Marqit', 'Marqit', 'manage_options', 'marqit-widget', 'marqit_widget_page' );
}
add_action( 'admin_menu', 'marqit_widget_menu' );

function marqit_widget_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$key = get_option( 'marqit_widget_key', '' );
	?>
	<div class="wrap">
		<h1>Marqit</h1>
		<p>Paste the site key we sent you and press Save. The widget then appears inside your articles automatically. There is nothing else to set up.</p>
		<form method="post" action="options.php">
			<?php settings_fields( 'marqit_widget' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="marqit_widget_key">Site key</label></th>
					<td>
						<input name="marqit_widget_key" id="marqit_widget_key" type="text" class="regular-text" value="<?php echo esc_attr( $key ); ?>" placeholder="mq_xxxxxxxxxxxxxxxx" autocomplete="off" />
						<p class="description"><?php echo $key ? 'Active. Open one of your articles to see it.' : 'Not active yet. Paste your key and save.'; ?></p>
					</td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>
		<p>Questions or problems? Email <a href="mailto:help@playmarqit.com">help@playmarqit.com</a>.</p>
	</div>
	<?php
}

function marqit_widget_settings_link( $links ) {
	array_unshift( $links, '<a href="' . esc_url( admin_url( 'options-general.php?page=marqit-widget' ) ) . '">Settings</a>' );
	return $links;
}
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'marqit_widget_settings_link' );

function marqit_widget_output() {
	if ( is_admin() || is_feed() || is_preview() || ! is_singular() ) {
		return;
	}
	$key = get_option( 'marqit_widget_key', '' );
	if ( ! $key ) {
		return;
	}
	echo '<script async src="https://playmarqit.com/embed.js" data-site="' . esc_attr( $key ) . '" data-mode="auto"></script>' . "\n";
}
add_action( 'wp_footer', 'marqit_widget_output' );
