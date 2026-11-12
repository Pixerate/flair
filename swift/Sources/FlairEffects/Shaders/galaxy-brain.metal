// flair-metal-hash: 9cc7b31c
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
}

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
    float2 uHead;
    int uLevel;
    float uStepTime;
    float uHold;
    float uSize;
    float3 uGlow;
    packed_float3 uNebula;
    float uDarken;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_galaxy_brain_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float vnoise(thread const float2& p)
{
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = (f * f) * (float2(3.0) - (f * 2.0));
    float2 param = i;
    float a = hash12(param);
    float2 param_1 = i + float2(1.0, 0.0);
    float b = hash12(param_1);
    float2 param_2 = i + float2(0.0, 1.0);
    float c = hash12(param_2);
    float2 param_3 = i + float2(1.0);
    float d = hash12(param_3);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

static inline __attribute__((always_inline))
float fbm(thread float2& p, thread const int& octaves)
{
    float sum = 0.0;
    float amp = 0.5;
    float2x2 turn = float2x2(float2(0.800000011920928955078125, 0.60000002384185791015625), float2(-0.60000002384185791015625, 0.800000011920928955078125));
    for (int i = 0; i < 8; i++)
    {
        if (i >= octaves)
        {
            break;
        }
        float2 param = p;
        sum += (amp * vnoise(param));
        p = ((turn * p) * 2.019999980926513671875) + float2(17.0);
        amp *= 0.5;
    }
    return sum;
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float stars(thread const float2& p, thread const float& n, constant FlairUniforms& _241)
{
    float2 cell = floor(p * n);
    float2 param = cell;
    float2 h = hash22(param);
    float2 d = fract(p * n) - (float2(0.20000000298023223876953125) + (h * 0.60000002384185791015625));
    float on = step(0.819999992847442626953125, h.x);
    float twinkle = 0.60000002384185791015625 + (0.4000000059604644775390625 * sin((_241.iTime * (1.0 + (2.0 * h.y))) + (h.x * 40.0)));
    return (on * twinkle) * exp((-dot(d, d)) * 260.0);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _241)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_241.uBackdrop) * _241.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_241.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _241)
{
    float4 _378;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _378 = overBackdrop(param, _241);
    }
    else
    {
        float2 param_1 = fract(uv);
        _378 = float4(testCard(param_1), 1.0);
    }
    return _378;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _241, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_241.iResolution[0], _241.iResolution[1]);
    float aspect = _241.iResolution[0u] / _241.iResolution[1u];
    float levels = float(_241.uLevel);
    float cycle = (0.60000002384185791015625 + (levels * _241.uStepTime)) + _241.uHold;
    float t = mod(_241.iTime, cycle) - 0.60000002384185791015625;
    float L = 0.0;
    for (int i = 0; i < 4; i++)
    {
        if (i >= _241.uLevel)
        {
            break;
        }
        L += smoothstep(0.0, 0.5, t - (float(i) * _241.uStepTime));
    }
    L *= smoothstep(cycle - 0.60000002384185791015625, (cycle - 0.60000002384185791015625) - 0.60000002384185791015625, t);
    float w1 = fast::clamp(L, 0.0, 1.0);
    float w2 = fast::clamp(L - 1.0, 0.0, 1.0);
    float w3 = fast::clamp(L - 2.0, 0.0, 1.0);
    float w4 = fast::clamp(L - 3.0, 0.0, 1.0);
    float2 p = uv * float2(aspect, 1.0);
    float2 d = p - (_241.uHead * float2(aspect, 1.0));
    float r = length(d);
    float a = precise::atan2(d.y, d.x);
    float S = _241.uSize * (1.0 + (0.5 * fast::max(L - 1.0, 0.0)));
    float halo = (exp((-r) / (S * 0.25)) * 0.60000002384185791015625) + (exp((-r) / S) * 0.25);
    float rays = powr(0.5 + (0.5 * cos((a * 12.0) + (_241.iTime * 0.4000000059604644775390625))), 6.0) + (0.60000002384185791015625 * powr(0.5 + (0.5 * cos(((a * 7.0) - (_241.iTime * 0.25)) + 1.0)), 10.0));
    rays *= (exp((-r) / (S * 1.2999999523162841796875)) * smoothstep(0.0, S * 0.20000000298023223876953125, r));
    float3 light = _241.uGlow * ((halo * w1) + ((rays * w2) * 0.5));
    if (w3 > 0.0)
    {
        float fade = exp((-r) / (_241.uSize * 2.0));
        if (fade > 0.0599999986588954925537109375)
        {
            float sw = (r * 2.5) - (_241.iTime * 0.07999999821186065673828125);
            float2 q = float2x2(float2(cos(sw), sin(sw)), float2(-sin(sw), cos(sw))) * d;
            float2 param = (q * 3.0) + float2(4.0);
            int param_1 = 2;
            float _693 = fbm(param, param_1);
            float n = _693;
            float neb = smoothstep(0.300000011920928955078125, 0.75, n) * fade;
            light += (((mix(float3(_241.uNebula), _241.uGlow, float3(smoothstep(0.449999988079071044921875, 0.800000011920928955078125, n))) * neb) * w3) * 0.89999997615814208984375);
        }
        float reach = mix(exp((-r) / (S * 2.0)), 1.0, w4);
        float2 param_2 = p;
        float param_3 = 26.0;
        float2 param_4 = p + float2(3.7000000476837158203125);
        float param_5 = 41.0;
        light += ((float3(stars(param_2, param_3, _241) + (stars(param_4, param_5, _241) * 0.699999988079071044921875)) * reach) * w3);
    }
    if (w4 > 0.0)
    {
        float burst = powr(0.5 + (0.5 * cos(((a * 36.0) + (sin(a * 5.0) * 2.0)) - (_241.iTime * 0.1500000059604644775390625))), 24.0) / (1.0 + (r * 2.5));
        light += ((((float3(1.0) * burst) * 0.449999988079071044921875) + ((mix(_241.uGlow, float3(1.0), float3(0.60000002384185791015625)) * exp((-r) / (S * 0.100000001490116119384765625))) * 1.10000002384185791015625)) * w4);
    }
    float2 param_6 = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_6, _241);
    float dark = (_241.uDarken * L) / 4.0;
    float3 col = mix(pic.xyz, pic.xyz * mix(float3(1.0), (float3(_241.uNebula) * 0.5) + float3(0.25), float3(0.699999988079071044921875)), float3(dark)) * (1.0 - (dark * 0.60000002384185791015625));
    col += light;
    float cover = fast::clamp(fast::max(fast::max(halo * w1, rays * w2), w3 * 0.4000000059604644775390625), 0.0, 1.0);
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), fast::max(pic.w, cover));
}

fragment flair_galaxy_brain_frag_out flair_galaxy_brain_frag(constant FlairUniforms& _241 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_galaxy_brain_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _871;
    if (_241.flair_flipY > 0.5)
    {
        _871 = _241.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _871 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _871);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _241, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

