// flair-metal-hash: 8cbca424
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    float uStretch;
    float uWave;
    float uWaves;
    float uSpeed;
    float uSheen;
    uint uFramed;
    float3 uFrameColor;
    float3 uWall;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_funhouse_mirror_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _54)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_54.uBackdrop) * _54.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_54.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float4 pictureBlurRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float& blurPx, constant FlairUniforms& _54)
{
    float2 size = float2(int2(tex.get_width(), tex.get_height()));
    if (size.x <= 1.0)
    {
        float2 param = fract(uv);
        return float4(testCard(param), 1.0);
    }
    float4 param_1 = tex.sample(texSmplr, uv, level(log2(fast::max((blurPx * size.x) / _54.iResolution[0u], 1.0))));
    return overBackdrop(param_1, _54);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _54, texture2d<float> uImage, sampler uImageSmplr)
{
    float px = 1.0 / _54.iResolution[1u];
    float aspect = _54.iResolution[0u] * px;
    float2 p = (fragCoord - (float2(_54.iResolution[0], _54.iResolution[1]) * 0.5)) * px;
    float2 _251;
    if (_54.uFramed != 0u)
    {
        _251 = float2(fast::min(0.319999992847442626953125, 0.4199999868869781494140625 * aspect), 0.4199999868869781494140625);
    }
    else
    {
        _251 = float2(0.5 * aspect, 0.5);
    }
    float2 radii = _251;
    float2 q = p / radii;
    float t = _54.iTime * _54.uSpeed;
    float bulge = sin(((q.y * _54.uWaves) * 3.141590118408203125) + t);
    float sx = (1.0 + (0.3499999940395355224609375 * _54.uStretch)) * (1.0 + ((_54.uWave * 0.3499999940395355224609375) * bulge));
    float sy = 1.0 - ((0.300000011920928955078125 * _54.uStretch) * (1.0 - ((0.4000000059604644775390625 * q.y) * q.y)));
    float2 src = float2(q.x / sx, (q.y * sy) + ((_54.uWave * 0.0500000007450580596923828125) * sin((q.x * 2.0) + (t * 0.699999988079071044921875)))) * radii;
    float2 param = (src / float2(aspect, 1.0)) + float2(0.5);
    float param_1 = 1.0;
    float4 pic = pictureBlurRGBA(uImage, uImageSmplr, param, param_1, _54);
    float3 glass = pic.xyz * float3(0.939999997615814208984375, 0.9700000286102294921875, 0.949999988079071044921875);
    glass *= (1.0 + ((0.119999997317790985107421875 * _54.uWave) * cos(((q.y * _54.uWaves) * 3.141590118408203125) + t)));
    float sweep = ((q.x + (q.y * 0.60000002384185791015625)) - 0.4000000059604644775390625) + (0.25 * sin(t * 0.5));
    glass += float3(_54.uSheen * ((0.2199999988079071044921875 * exp(((-sweep) * sweep) * 30.0)) + (0.100000001490116119384765625 * exp(-powr((sweep + 0.25) * 20.0, 2.0)))));
    if (!(_54.uFramed != 0u))
    {
        fragColor = float4(glass, pic.w);
        return;
    }
    float r = length(q);
    float inside = fast::clamp((((1.0 - r) * radii.y) / px) + 0.5, 0.0, 1.0);
    float a = precise::atan2(q.y, q.x);
    float outer = 1.13999998569488525390625 + (0.01200000010430812835693359375 * smoothstep(0.300000011920928955078125, 1.0, abs(sin(a * 24.0))));
    float inFrame = fast::clamp((((outer - r) * radii.y) / px) + 0.5, 0.0, 1.0);
    float across = fast::clamp((r - 1.0) / (outer - 1.0), 0.0, 1.0);
    float round_ = sin(across * 3.141590118408203125);
    float2 n2 = (q / float2(fast::max(r, 0.001000000047497451305389404296875))) * cos(across * 3.141590118408203125);
    float lit = 0.550000011920928955078125 + (0.449999988079071044921875 * dot(n2, float2(-0.529998958110809326171875, 0.847998321056365966796875)));
    float3 gilt = (_54.uFrameColor * (0.3499999940395355224609375 + ((0.75 * round_) * lit))) + ((float3(1.0, 0.949999988079071044921875, 0.800000011920928955078125) * powr(fast::max(round_ * lit, 0.0), 12.0)) * 0.60000002384185791015625);
    float3 wall = _54.uWall * (1.0 - (0.449999988079071044921875 * exp((-fast::max(length((p + float2(-0.014999999664723873138427734375, 0.0199999995529651641845703125)) / radii) - outer, 0.0)) * 8.0)));
    float3 col = mix(wall, gilt, float3(inFrame));
    col = mix(col, glass, float3(inside));
    fragColor = float4(col, mix(1.0, pic.w, inside));
}

fragment flair_funhouse_mirror_frag_out flair_funhouse_mirror_frag(constant FlairUniforms& _54 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_funhouse_mirror_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _582;
    if (_54.flair_flipY > 0.5)
    {
        _582 = _54.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _582 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _582);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _54, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

