// flair-metal-hash: 7b471adc
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
    packed_float3 uPhosphor;
    float uScanlines;
    float uCurve;
    float uAfterglow;
    uint uAnimate;
    float uProgress;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_crt_power_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 switchOn(thread const float& u)
{
    float sx = smoothstep(0.0, 0.300000011920928955078125, u);
    float sy = smoothstep(0.300000011920928955078125, 1.0, u);
    return float4(sx, sy * sy, (1.0 - smoothstep(0.300000011920928955078125, 1.0, u)) * step(0.001000000047497451305389404296875, u), 0.0);
}

static inline __attribute__((always_inline))
float4 switchOff(thread const float& u)
{
    float sy = 1.0 - smoothstep(0.0, 0.5, u);
    float sx = 1.0 - smoothstep(0.5, 1.0, u);
    return float4(sx, sy, smoothstep(0.0, 0.5, u), smoothstep(0.75, 1.0, u));
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _65)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_65.uBackdrop) * _65.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_65.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _65)
{
    float4 _209;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _209 = overBackdrop(param, _65);
    }
    else
    {
        float2 param_1 = fract(uv);
        _209 = float4(testCard(param_1), 1.0);
    }
    return _209;
}

static inline __attribute__((always_inline))
float scanlines(thread const float& y, thread const float& amount)
{
    return 1.0 - ((amount * 0.5) * (1.0 - cos(y * 3.141590118408203125)));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _65, texture2d<float> uImage, sampler uImageSmplr)
{
    float aspect = _65.iResolution[0u] / _65.iResolution[1u];
    float px = 2.0 / _65.iResolution[1u];
    float2 q = ((fragCoord / float2(_65.iResolution[0], _65.iResolution[1])) * 2.0) - float2(1.0);
    q *= (1.0 + ((_65.uCurve * dot(q.yx, q.yx)) * 0.5));
    bool _316 = abs(q.x) > 1.0;
    bool _324;
    if (!_316)
    {
        _324 = abs(q.y) > 1.0;
    }
    else
    {
        _324 = _316;
    }
    if (_324)
    {
        fragColor = float4(0.0, 0.0, 0.0, _65.uBackdropAlpha);
        return;
    }
    float4 state;
    if (_65.uAnimate != 0u)
    {
        float c = mod(_65.iTime, 5.0);
        if (c < 0.4000000059604644775390625)
        {
            state = float4(0.0);
        }
        else
        {
            if (c < 1.10000002384185791015625)
            {
                float param = (c - 0.4000000059604644775390625) / 0.699999988079071044921875;
                state = switchOn(param);
            }
            else
            {
                if (c < 3.599999904632568359375)
                {
                    state = float4(1.0, 1.0, 0.0, 0.0);
                }
                else
                {
                    if (c < 4.19999980926513671875)
                    {
                        float param_1 = (c - 3.599999904632568359375) / 0.60000002384185791015625;
                        state = switchOff(param_1);
                    }
                    else
                    {
                        state = float4(0.0, 0.0, 0.0, 1.0 - smoothstep(4.19999980926513671875, 5.0, c));
                    }
                }
            }
        }
    }
    else
    {
        float param_2 = fast::clamp(_65.uProgress, 0.0, 1.0);
        state = switchOn(param_2);
    }
    float sx = state.x;
    float sy = fast::max(state.y, px * 1.5);
    float flare = state.z;
    float2 st = float2(0.5) + ((q * 0.5) / fast::max(float2(sx, sy), float2(0.001000000047497451305389404296875)));
    float2 param_3 = fast::clamp(st, float2(0.0), float2(1.0));
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_3, _65);
    float3 col = mix(pic.xyz, float3(_65.uPhosphor), float3(0.85000002384185791015625 * flare)) * (1.0 + (1.5 * flare));
    float param_4 = fragCoord.y;
    float param_5 = _65.uScanlines;
    col *= scanlines(param_4, param_5);
    float open = ((1.0 - smoothstep(sx - px, sx + px, abs(q.x))) * (1.0 - smoothstep(sy - px, sy + px, abs(q.y)))) * step(0.001000000047497451305389404296875, sx);
    float3 screen = float3(0.0199999995529651641845703125, 0.02500000037252902984619140625, 0.02999999932944774627685546875);
    float3 outCol = mix(screen, col, float3(open));
    float alpha = mix(_65.uBackdropAlpha, pic.w, open);
    float off = fast::max(abs(q.y) - sy, 0.0);
    float bloom = ((flare * exp(((-off) * off) * 900.0)) * (1.0 - smoothstep(sx, sx + 0.07999999821186065673828125, abs(q.x)))) * 0.800000011920928955078125;
    float r = length(q * float2(aspect, 1.0));
    float spot = (_65.uAfterglow * state.w) * (exp(((-r) * r) * 900.0) + (0.300000011920928955078125 * exp(((-r) * r) * 40.0)));
    float3 glow = float3(_65.uPhosphor) * (bloom + spot);
    outCol += glow;
    alpha = fast::max(alpha, fast::clamp(bloom + spot, 0.0, 1.0));
    outCol *= smoothstep(1.0, 0.699999988079071044921875, (fast::max(abs(q.x), abs(q.y)) * 0.980000019073486328125) + (0.0199999995529651641845703125 * length(q)));
    fragColor = float4(fast::clamp(outCol, float3(0.0), float3(1.0)), alpha);
}

fragment flair_crt_power_frag_out flair_crt_power_frag(constant FlairUniforms& _65 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_crt_power_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _603;
    if (_65.flair_flipY > 0.5)
    {
        _603 = _65.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _603 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _603);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _65, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

